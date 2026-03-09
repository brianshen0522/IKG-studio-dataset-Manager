import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, isJobLabelPathAllowed } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export const GET = withApiLogging(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const label = searchParams.get('label');
    const basePath = searchParams.get('basePath');
    const relativeLabel = searchParams.get('relativeLabel');
    const jobId = searchParams.get('jobId');

    let labelPath = label;

    if (basePath && relativeLabel) {
      labelPath = path.join(basePath, relativeLabel);
    }

    if (jobId) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const folderPath = relativeLabel
        ? relativeLabel.replace(/\\/g, '/').split('/').slice(0, -1).join('/').replace(/\/labels$/, '/images')
        : 'images';
      const { labelPathSet } = buildJobEditorPaths(dataset.datasetPath, job, folderPath);
      if (relativeLabel && !isJobLabelPathAllowed(relativeLabel, labelPathSet)) {
        return NextResponse.json({ error: 'Label is outside this job scope' }, { status: 403 });
      }
    }

    if (!labelPath) {
      return NextResponse.json({ error: 'Missing label path' }, { status: 400 });
    }

    let labelContent = '';
    if (fs.existsSync(labelPath)) {
      labelContent = fs.readFileSync(labelPath, 'utf-8');
    }

    return NextResponse.json({ labelPath, labelContent });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
