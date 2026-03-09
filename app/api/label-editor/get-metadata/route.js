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
    const { basePath, images, jobId } = body;

    if (!basePath || !images || !Array.isArray(images)) {
      return NextResponse.json({ error: 'Missing basePath or images array' }, { status: 400 });
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

      const folderPath = images.find(Boolean)?.replace(/\\/g, '/').split('/').slice(0, -1).join('/') || 'images';
      allowedImagePathSet = buildJobEditorPaths(dataset.datasetPath, job, folderPath).imagePathSet;
    }

    const metadata = {};

    for (const imagePath of images) {
      if (allowedImagePathSet && !isJobImagePathAllowed(imagePath, allowedImagePathSet)) {
        continue;
      }
      try {
        const labelPath = imagePath
          .replace('images/', 'labels/')
          .replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
        const fullLabelPath = path.join(basePath, labelPath);

        let labelContent = '';
        if (fs.existsSync(fullLabelPath)) {
          labelContent = fs.readFileSync(fullLabelPath, 'utf-8');
        }

        const lines = labelContent.trim().split('\n').filter((line) => line.trim());
        const annotations = [];

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const classId = parseInt(parts[0], 10);
            if (!Number.isNaN(classId)) {
              annotations.push(classId);
            }
          }
        }

        const classes = [...new Set(annotations)];

        metadata[imagePath] = {
          classes,
          count: annotations.length
        };
      } catch (err) {
        metadata[imagePath] = {
          classes: [],
          count: 0
        };
      }
    }

    return NextResponse.json({ metadata });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
