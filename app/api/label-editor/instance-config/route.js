import { NextResponse } from 'next/server';
import path from 'path';
import { CONFIG } from '@/lib/manager';
import { getInstanceByName } from '@/lib/db';
import { getJobById, getDatasetById, getJobUserState } from '@/lib/db-datasets';
import { getUserFromRequest } from '@/lib/auth';
import { canAccessJob, canViewAll } from '@/lib/permissions';
import fs from 'fs';
import { buildJobEditorPaths } from '@/lib/job-scope';
import { withApiLogging } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';

function buildDatasetFolder(datasetPath) {
  const basePath = path.resolve(CONFIG.datasetBasePath).replace(/\/+$/, '');
  let folder = '';
  if (datasetPath.startsWith(`${basePath}/`)) {
    const rel = datasetPath.slice(basePath.length + 1).replace(/\/+$/, '');
    folder = rel.endsWith('/images') || rel === 'images' ? rel : `${rel}/images`;
  } else {
    folder = path.join(datasetPath, 'images');
  }
  return { basePath, folder };
}

export const GET = withApiLogging(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const datasetId = searchParams.get('datasetId');

    // ---- New: job-based config ----
    if (jobId) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const userState = await getJobUserState(Number(jobId), Number(actor.sub));

      const datasetPath = dataset.datasetPath || '';
      const { basePath, folder } = buildDatasetFolder(datasetPath);

      const { imagePaths, filenames } = buildJobEditorPaths(datasetPath, job, folder);
      const imageMeta = {};
      for (const filename of filenames) {
        const fullImagePath = path.join(datasetPath, 'images', filename);
        try {
          const stat = fs.statSync(fullImagePath);
          const editorPath = path.posix.join(folder.replace(/\\/g, '/').replace(/\/+$/, ''), filename);
          imageMeta[editorPath] = {
            ctimeMs: stat.birthtimeMs || stat.ctimeMs,
            mtimeMs: stat.mtimeMs
          };
        } catch {
          // Ignore unreadable files; the editor can still operate without timestamps.
        }
      }

      return NextResponse.json({
        // Job identity
        jobId: job.id,
        jobIndex: job.jobIndex,
        datasetId: dataset.id,
        // Paths
        basePath,
        folder,
        datasetPath,
        // Job range
        imageStart: job.imageStart,
        imageEnd: job.imageEnd,
        totalImagesInJob: imagePaths.length,
        images: imagePaths,
        imageMeta,
        // Settings
        obbMode: dataset.obbMode || 'rectangle',
        classFile: dataset.classFile || null,
        labelEditorPreloadCount: CONFIG.labelEditorPreloadCount,
        // Per-user state
        lastImagePath: userState?.lastImagePath || ''
      });
    }

    if (datasetId) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const dataset = await getDatasetById(Number(datasetId));
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
      if (!canViewAll(actor) && dataset.createdBy !== Number(actor.sub)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const datasetPath = dataset.datasetPath || '';
      const { basePath, folder } = buildDatasetFolder(datasetPath);

      return NextResponse.json({
        datasetId: dataset.id,
        basePath,
        folder,
        datasetPath,
        obbMode: dataset.obbMode || 'rectangle',
        classFile: dataset.classFile || null,
        labelEditorPreloadCount: CONFIG.labelEditorPreloadCount
      });
    }

    // ---- Legacy: instance-name-based config ----
    const name = searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'Missing jobId, datasetId, or name' }, { status: 400 });

    const instance = await getInstanceByName(name);
    if (!instance) return NextResponse.json({ error: `Instance not found: ${name}` }, { status: 404 });

    const datasetPath = instance.datasetPath || '';
    const { basePath, folder } = buildDatasetFolder(datasetPath);

    return NextResponse.json({
      basePath,
      folder,
      obbMode: instance.obbMode || 'rectangle',
      lastImagePath: instance.lastImagePath || '',
      instanceName: instance.name,
      labelEditorPreloadCount: CONFIG.labelEditorPreloadCount
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
