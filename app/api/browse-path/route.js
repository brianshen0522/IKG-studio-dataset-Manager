import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { containsClassFiles } from '@/lib/manager';
import { CONFIG } from '@/lib/manager';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromHeaders } from '@/lib/auth';
import { isAdminOrDM } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export const GET = withApiLogging(async (req) => {
  const actor = getUserFromHeaders(req);
  if (!isAdminOrDM(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const basePath = path.resolve(CONFIG.datasetBasePath || '/');
    let browsePath = searchParams.get('path') || basePath;
    const filterClassFiles = searchParams.get('filterClassFiles') === 'true';

    if (browsePath === '' || browsePath === 'root') browsePath = basePath;

    const resolvedBrowsePath = path.resolve(browsePath);
    const relativeToBase = path.relative(basePath, resolvedBrowsePath);
    const isInsideBase =
      relativeToBase === '' || (!relativeToBase.startsWith('..') && !path.isAbsolute(relativeToBase));

    const safeBrowsePath = isInsideBase ? resolvedBrowsePath : basePath;

    if (!fs.existsSync(safeBrowsePath)) {
      return NextResponse.json({ folders: [], files: [], currentPath: basePath, basePath, parent: null });
    }

    const stat = fs.statSync(safeBrowsePath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ folders: [], files: [], currentPath: basePath, basePath, parent: null });
    }

    const parentDir = path.dirname(safeBrowsePath);
    const parent = safeBrowsePath === basePath ? null : parentDir;

    const entries = fs.readdirSync(safeBrowsePath, { withFileTypes: true });
    const folders = [];
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      try {
        if (entry.isDirectory()) {
          if (filterClassFiles) {
            if (containsClassFiles(path.join(safeBrowsePath, entry.name))) folders.push(entry.name);
          } else {
            folders.push(entry.name);
          }
        } else if (entry.isFile()) {
          files.push(entry.name);
        }
      } catch { /* skip inaccessible entries */ }
    }

    folders.sort();
    files.sort();
    return NextResponse.json({ folders, files, currentPath: safeBrowsePath, basePath, parent });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
