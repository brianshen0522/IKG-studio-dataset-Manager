import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, scanFolderImagePaths } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function parseLabelFile(fullLabelPath) {
  let labelContent = '';
  if (fs.existsSync(fullLabelPath)) labelContent = fs.readFileSync(fullLabelPath, 'utf-8');
  const lines = labelContent.trim().split('\n').filter((line) => line.trim());
  const annotations = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const classId = parseInt(parts[0], 10);
      if (!Number.isNaN(classId)) annotations.push(classId);
    }
  }
  return { classes: [...new Set(annotations)], count: annotations.length };
}

export const POST = withApiLogging(async (req) => {
  try {
    const body = await req.json();
    const { basePath, images, imageNames, jobId, view } = body;

    // Job-based mode: { jobId, imageNames } — returns metadata keyed by filename
    if (jobId && imageNames) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const folder = view === 'duplicates' ? 'duplicate/images' : 'images';
      const { imagePathSet } = view === 'duplicates'
        ? scanFolderImagePaths(dataset.datasetPath, folder)
        : buildJobEditorPaths(dataset.datasetPath, job, folder);

      const metadata = {};
      for (const name of imageNames) {
        if (!imagePathSet.has(`${folder}/${name}`)) continue;
        const labelName = name.replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
        const labelFolder = folder.replace('images', 'labels');
        const fullLabelPath = path.join(dataset.datasetPath, labelFolder, labelName);
        metadata[name] = parseLabelFile(fullLabelPath);
      }

      return NextResponse.json({ metadata });
    }

    // Legacy path-based mode: { basePath, images } — returns metadata keyed by relative path
    if (!basePath || !images || !Array.isArray(images)) {
      return NextResponse.json({ error: 'Missing basePath or images array' }, { status: 400 });
    }

    const metadata = {};
    for (const imagePath of images) {
      const labelPath = imagePath
        .replace('images/', 'labels/')
        .replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
      const fullLabelPath = path.join(basePath, labelPath);
      metadata[imagePath] = parseLabelFile(fullLabelPath);
    }

    return NextResponse.json({ metadata });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
