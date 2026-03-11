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
    const jobId = searchParams.get('jobId');
    const imageName = searchParams.get('imageName');

    // ── Job-based (new): ?jobId=&imageName= ───────────────────────────────
    if (jobId) {
      if (!imageName) return NextResponse.json({ error: 'Missing imageName' }, { status: 400 });

      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const labelName = imageName.replace(/\.[^.]+$/i, '.txt');
      const relativeLabelPath = `labels/${labelName}`;
      const { labelPathSet } = buildJobEditorPaths(dataset.datasetPath, job, 'images');
      if (!isJobLabelPathAllowed(relativeLabelPath, labelPathSet)) {
        return NextResponse.json({ error: 'Label is outside this job scope' }, { status: 403 });
      }

      const fullLabelPath = path.join(dataset.datasetPath, relativeLabelPath);
      const labelContent = fs.existsSync(fullLabelPath)
        ? fs.readFileSync(fullLabelPath, 'utf-8')
        : '';
      return NextResponse.json({ labelContent });
    }

    // ── Legacy: ?basePath=&relativeLabel= or ?label= ──────────────────────
    const label = searchParams.get('label');
    const basePath = searchParams.get('basePath');
    const relativeLabel = searchParams.get('relativeLabel');
    const labelPath = (basePath && relativeLabel) ? path.join(basePath, relativeLabel) : label;

    if (!labelPath) return NextResponse.json({ error: 'Missing label path' }, { status: 400 });

    const labelContent = fs.existsSync(labelPath) ? fs.readFileSync(labelPath, 'utf-8') : '';
    return NextResponse.json({ labelContent });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
