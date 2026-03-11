import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, isJobLabelPathAllowed } from '@/lib/job-scope';
import { canEditJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export const POST = withApiLogging(async (req) => {
  try {
    const { jobId, imageName, content } = await req.json();

    if (!jobId || !imageName) {
      return NextResponse.json({ error: 'Missing jobId or imageName' }, { status: 400 });
    }

    const actor = await getUserFromRequest(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const job = await getJobById(Number(jobId));
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!canEditJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const dataset = await getDatasetById(job.datasetId);
    if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

    const { labelPathSet } = buildJobEditorPaths(dataset.datasetPath, job, 'images');
    const relativeLabelPath = `labels/${imageName.replace(/\.[^.]+$/i, '.txt')}`;

    if (!isJobLabelPathAllowed(relativeLabelPath, labelPathSet)) {
      return NextResponse.json({ error: 'Image is outside this job scope' }, { status: 403 });
    }

    const fullLabelPath = path.join(dataset.datasetPath, relativeLabelPath);
    fs.mkdirSync(path.dirname(fullLabelPath), { recursive: true });
    fs.writeFileSync(fullLabelPath, content || '', 'utf-8');

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
