import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { withApiLogging } from '@/lib/api-logger';
import { getInstanceByName } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, isJobImagePathAllowed } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif'
};

export const GET = withApiLogging(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const basePath = searchParams.get('basePath');
    const relativePath = searchParams.get('relativePath');
    const fullPath = searchParams.get('fullPath');
    const instanceName = searchParams.get('i');
    const imageName = searchParams.get('n');
    const jobId = searchParams.get('jobId');

    let imagePath = fullPath;

    // Mode 1: jobId + imageName (job-based, no server path needed from client)
    if (jobId && imageName && !instanceName) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const { imagePathSet } = buildJobEditorPaths(dataset.datasetPath, job, 'images');
      if (!isJobImagePathAllowed(`images/${imageName}`, imagePathSet)) {
        return NextResponse.json({ error: 'Image is outside this job scope' }, { status: 403 });
      }

      imagePath = path.join(dataset.datasetPath, 'images', imageName);
    }
    // Mode 2: Short URL with instance name + image filename
    else if (instanceName && imageName) {
      const instance = await getInstanceByName(instanceName);
      if (!instance) {
        return NextResponse.json({ error: `Instance not found: ${instanceName}` }, { status: 404 });
      }
      imagePath = path.join(instance.datasetPath, 'images', imageName);
    }
    // Mode 3: basePath + relativePath (legacy)
    else if (basePath && relativePath) {
      imagePath = path.join(basePath, relativePath);
    }
    // Mode 4: fullPath (already set above)

    if (!imagePath || !fs.existsSync(imagePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const stream = fs.createReadStream(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(Readable.toWeb(stream), {
      headers: {
        'Content-Type': contentType
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
