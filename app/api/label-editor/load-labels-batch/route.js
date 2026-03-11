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
    const body = await req.json();
    const { jobId, imageNames, basePath, imagePaths, view } = body;

    // ── Job-based (new): { jobId, imageNames } ─────────────────────────────
    if (jobId) {
      const names = imageNames ?? (imagePaths || []).map((p) => p.split('/').pop());
      if (!Array.isArray(names)) {
        return NextResponse.json({ error: 'Missing imageNames array' }, { status: 400 });
      }

      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const { imagePathSet } = buildJobEditorPaths(dataset.datasetPath, job, 'images');

      const labels = {};
      await Promise.all(names.map(async (imageName) => {
        if (!isJobImagePathAllowed(`images/${imageName}`, imagePathSet)) return;
        const labelName = imageName.replace(/\.[^.]+$/i, '.txt');
        const fullLabelPath = path.join(dataset.datasetPath, 'labels', labelName);
        try {
          labels[imageName] = fs.existsSync(fullLabelPath)
            ? fs.readFileSync(fullLabelPath, 'utf-8')
            : '';
        } catch {
          labels[imageName] = '';
        }
      }));

      return NextResponse.json({ labels });
    }

    // ── Legacy path-based (fallback): { basePath, imagePaths } ─────────────
    if (!basePath || !Array.isArray(imagePaths)) {
      return NextResponse.json({ error: 'Missing jobId or basePath/imagePaths' }, { status: 400 });
    }

    const labels = {};
    await Promise.all(imagePaths.map(async (imagePath) => {
      const labelPath = imagePath
        .replace('images/', 'labels/')
        .replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
      const fullLabelPath = path.join(basePath, labelPath);
      try {
        labels[imagePath] = fs.existsSync(fullLabelPath)
          ? fs.readFileSync(fullLabelPath, 'utf-8')
          : '';
      } catch {
        labels[imagePath] = '';
      }
    }));

    return NextResponse.json({ labels });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
