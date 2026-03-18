import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getUserShortcuts, setUserShortcuts } from '@/lib/db';
import { DEFAULT_SHORTCUTS } from '@/lib/shortcuts-defaults';

export const dynamic = 'force-dynamic';

// GET /api/profile/shortcuts — returns merged shortcuts (defaults + user overrides)
export const GET = withApiLogging(async (req) => {
  const actor = await getUserFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const overrides = await getUserShortcuts(Number(actor.sub));
  const shortcuts = { ...DEFAULT_SHORTCUTS, ...overrides };
  return NextResponse.json({ shortcuts, overrides });
});

// PUT /api/profile/shortcuts — save user overrides (sparse diff from defaults)
export const PUT = withApiLogging(async (req) => {
  const actor = await getUserFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { shortcuts } = body || {};
  if (!shortcuts || typeof shortcuts !== 'object' || Array.isArray(shortcuts)) {
    return NextResponse.json({ error: 'shortcuts must be an object' }, { status: 400 });
  }

  // Validate: only known action keys, non-empty string values
  const validKeys = new Set(Object.keys(DEFAULT_SHORTCUTS));
  const overrides = {};
  for (const [action, key] of Object.entries(shortcuts)) {
    if (!validKeys.has(action)) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    if (typeof key !== 'string' || !key.trim()) {
      return NextResponse.json({ error: `Invalid key for action ${action}` }, { status: 400 });
    }
    // Only store if different from default
    if (key !== DEFAULT_SHORTCUTS[action]) {
      overrides[action] = key;
    }
  }

  await setUserShortcuts(Number(actor.sub), overrides);
  const merged = { ...DEFAULT_SHORTCUTS, ...overrides };
  return NextResponse.json({ shortcuts: merged, overrides });
});

// DELETE /api/profile/shortcuts — reset all shortcuts to defaults
export const DELETE = withApiLogging(async (req) => {
  const actor = await getUserFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await setUserShortcuts(Number(actor.sub), {});
  return NextResponse.json({ shortcuts: { ...DEFAULT_SHORTCUTS }, overrides: {} });
});
