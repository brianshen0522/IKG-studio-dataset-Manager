import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getMyJobs } from '@/lib/my-jobs';

export const dynamic = 'force-dynamic';

// GET /api/my-jobs — returns all jobs assigned to the current user
export const GET = withApiLogging(async function handler(req) {
  const actor = await getUserFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = await getMyJobs(actor.sub);
  return NextResponse.json({ jobs });
});
