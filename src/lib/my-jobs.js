import { getPool } from './db.js';

export async function getMyJobs(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       j.id,
       j.dataset_id    AS "datasetId",
       j.job_index     AS "jobIndex",
       j.image_start   AS "imageStart",
       j.image_end     AS "imageEnd",
       j.status,
       j.assigned_to   AS "assignedTo",
       d.dataset_path  AS "datasetPath",
       d.display_name  AS "datasetName"
     FROM jobs j
     JOIN datasets d ON d.id = j.dataset_id
     WHERE j.assigned_to = $1
     ORDER BY j.dataset_id, j.job_index`,
    [Number(userId)]
  );

  return rows;
}
