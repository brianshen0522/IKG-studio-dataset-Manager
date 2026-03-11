import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromHeaders } from '@/lib/auth';
import { isAdminOrDM } from '@/lib/permissions';
import { getMatchingDuplicateRule, CONFIG } from '@/lib/manager';

export const dynamic = 'force-dynamic';

// GET /api/duplicate-rule?path=<datasetPath>
// Returns the auto-resolved duplicate rule for a given path, plus the global defaults.
export const GET = withApiLogging(async (req) => {
  const actor = getUserFromHeaders(req);
  if (!isAdminOrDM(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const datasetPath = searchParams.get('path') || '';

  const rule = getMatchingDuplicateRule(datasetPath);

  return NextResponse.json({
    action: rule.action,
    labels: rule.labels,
    matchedPattern: rule.matchedPattern,
    iouThreshold: CONFIG.defaultIouThreshold,
    debug: CONFIG.defaultDebug,
    rules: CONFIG.duplicateRules,
    defaultAction: CONFIG.duplicateDefaultAction,
  });
});
