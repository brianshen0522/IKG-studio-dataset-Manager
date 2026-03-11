/**
 * Task helpers built on top of pg-boss.
 *
 * pg-boss manages jobs in the `pgboss` schema.
 * We store human-readable log lines in our own `task_logs` table,
 * keyed by the pg-boss job UUID.
 *
 * pg-boss job states → UI status mapping:
 *   created  → pending
 *   retry    → pending
 *   active   → running
 *   completed → completed
 *   failed   → failed
 *   cancelled → cancelled
 *   expired  → failed
 */

import { getPool, ensureInitialized } from './db.js';

// ---------------------------------------------------------------------------
// State mapping
// ---------------------------------------------------------------------------

function mapState(state) {
  if (state === 'active')    return 'running';
  if (state === 'completed') return 'completed';
  if (state === 'failed')    return 'failed';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'expired')   return 'failed';
  return 'pending'; // created, retry
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToTask(row) {
  if (!row) return null;
  const data = row.data || {};
  const output = row.output || {};
  return {
    id: row.id,                                                  // UUID from pg-boss
    type: row.name || 'duplicate-scan',
    datasetId: data.datasetId ?? null,
    datasetName: row.dataset_name || data.datasetName || null,
    datasetPath: row.dataset_path || data.datasetPath || null,
    status: mapState(row.state),
    createdBy: data.createdBy ?? null,
    createdByUsername: row.created_by_username || null,
    createdAt: row.createdon ? new Date(row.createdon).toISOString() : null,
    startedAt: row.startedon ? new Date(row.startedon).toISOString() : null,
    completedAt: row.completedon ? new Date(row.completedon).toISOString() : null,
    error: row.state === 'failed' || row.state === 'expired'
      ? (output.message || output.error || null)
      : null,
    logs: Array.isArray(row.logs) ? row.logs : [],
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const TASK_QUERY = `
  SELECT
    j.id,
    j.name,
    j.data,
    j.state,
    j.created_on   AS createdon,
    j.started_on   AS startedon,
    j.completed_on AS completedon,
    j.output,
    COALESCE(d.display_name, split_part(d.dataset_path, '/', -1)) AS dataset_name,
    d.dataset_path,
    u.username AS created_by_username,
    COALESCE(
      json_agg(tl ORDER BY tl.ts ASC) FILTER (WHERE tl.id IS NOT NULL),
      '[]'
    ) AS logs
  FROM pgboss.job j
  LEFT JOIN datasets d ON d.id = (j.data->>'datasetId')::integer
  LEFT JOIN users u ON u.id = (j.data->>'createdBy')::integer
  LEFT JOIN task_logs tl ON tl.job_id = j.id
  WHERE j.name = 'duplicate-scan'
`;

const GROUP_BY = `
  GROUP BY j.id, j.name, j.data, j.state,
           j.created_on, j.started_on, j.completed_on, j.output,
           d.display_name, d.dataset_path, u.username
`;

export async function getAllTasks({ limit = 100 } = {}) {
  await ensureInitialized();
  const client = await getPool().connect();
  try {
    const result = await client.query(
      TASK_QUERY + GROUP_BY + ' ORDER BY j.created_on DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(rowToTask);
  } catch (err) {
    if (err.code === '42P01') return []; // pgboss schema not ready yet
    console.error('[db-tasks] getAllTasks error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export async function getTaskById(id) {
  await ensureInitialized();
  const client = await getPool().connect();
  try {
    const result = await client.query(
      TASK_QUERY + ' AND j.id = $1' + GROUP_BY,
      [id]
    );
    return rowToTask(result.rows[0]);
  } catch (err) {
    if (err.code === '42P01') return null;
    console.error('[db-tasks] getTaskById error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/** Append a log line for a pg-boss job (by UUID). */
export async function appendTaskLog(jobId, level, message) {
  await ensureInitialized();
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO task_logs (job_id, level, message) VALUES ($1, $2, $3)`,
      [jobId, level, message]
    );
  } finally {
    client.release();
  }
}

/** Returns true if the dataset has any pending or running pg-boss jobs. */
export async function datasetHasRunningTask(datasetId) {
  await ensureInitialized();
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT 1 FROM pgboss.job
       WHERE name = 'duplicate-scan'
         AND (data->>'datasetId')::integer = $1
         AND state IN ('created', 'retry', 'active')
       LIMIT 1`,
      [datasetId]
    );
    return result.rowCount > 0;
  } catch (err) {
    if (err.code === '42P01') return false; // pgboss schema not ready yet
    throw err;
  } finally {
    client.release();
  }
}
