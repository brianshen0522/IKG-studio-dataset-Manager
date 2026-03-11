import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, scanFolderImagePaths } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// POST: job-based — body: { jobId }
export const POST = withApiLogging(async (req) => {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const actor = await getUserFromRequest(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const job = await getJobById(Number(jobId));
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const dataset = await getDatasetById(job.datasetId);
    if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

    const { filenames } = buildJobEditorPaths(dataset.datasetPath, job, 'images');

    return NextResponse.json({ images: filenames, count: filenames.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

// GET: legacy path-based — ?basePath=...&folder=...
export const GET = withApiLogging(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const basePath = searchParams.get('basePath');
    const folder = searchParams.get('folder');

    if (!basePath || !folder) {
      return NextResponse.json({ error: 'Missing basePath or folder parameter' }, { status: 400 });
    }

    const fullPath = path.join(basePath, folder);
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const { imagePaths, imageMeta } = scanFolderImagePaths(basePath, folder);

    return NextResponse.json({ images: imagePaths, count: imagePaths.length, imageMeta });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
