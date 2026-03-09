import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, isJobImagePathAllowed } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export const POST = withApiLogging(async (req) => {
  try {
    const { basePath, imagePaths, jobId } = await req.json();

    if (!basePath || !imagePaths || !Array.isArray(imagePaths)) {
      return NextResponse.json({ error: 'Missing basePath or imagePaths array' }, { status: 400 });
    }

    let allowedImagePathSet = null;
    if (jobId) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const folderPath = imagePaths.find(Boolean)?.replace(/\\/g, '/').split('/').slice(0, -1).join('/') || 'images';
      allowedImagePathSet = buildJobEditorPaths(dataset.datasetPath, job, folderPath).imagePathSet;
    }

    // Process all labels in parallel
    const labels = {};
    await Promise.all(imagePaths.map(async (imagePath) => {
      if (allowedImagePathSet && !isJobImagePathAllowed(imagePath, allowedImagePathSet)) {
        return;
      }
      const labelPath = imagePath
        .replace('images/', 'labels/')
        .replace(/\.(jpg|jpeg|png)$/i, '.txt');
      const fullLabelPath = path.join(basePath, labelPath);

      let labelContent = '';
      try {
        if (fs.existsSync(fullLabelPath)) {
          labelContent = fs.readFileSync(fullLabelPath, 'utf-8');
        }
      } catch (err) {
        // Ignore individual file errors
      }
      labels[imagePath] = labelContent;
    }));

    return NextResponse.json({ labels });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
