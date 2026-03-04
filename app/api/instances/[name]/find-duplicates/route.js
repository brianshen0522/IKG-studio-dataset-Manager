import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { getInstanceByName } from '@/lib/db';
import { getPythonBin } from '@/lib/manager';
import { withApiLogging } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';

function runDuplicateFinder(args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const pythonBin = getPythonBin();
    const scriptPath = path.join(process.cwd(), 'duplicate_finder.py');
    const proc = execFile(pythonBin, [scriptPath, ...args], { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export const POST = withApiLogging(async (req, { params }) => {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json({ error: 'Instance name required' }, { status: 400 });
    }

    const instance = await getInstanceByName(name);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (!instance.datasetPath) {
      return NextResponse.json({ error: 'Instance has no dataset path configured' }, { status: 400 });
    }

    const outputJson = path.join(os.tmpdir(), `dupes_${name}_${Date.now()}.json`);
    const action = instance.duplicateMode && instance.duplicateMode !== 'none' ? instance.duplicateMode : 'move';
    const threshold = instance.threshold || 0.8;

    const args = [
      '--dataset-path', instance.datasetPath,
      '--iou-threshold', String(threshold),
      '--output-json', outputJson,
      '--action', action
    ];

    if (instance.debug) {
      args.push('--debug');
    }

    try {
      await runDuplicateFinder(args);
    } catch (err) {
      return NextResponse.json({ error: `Duplicate finder failed: ${err.message}` }, { status: 500 });
    }

    if (!fs.existsSync(outputJson)) {
      return NextResponse.json({ error: 'Duplicate finder did not produce output' }, { status: 500 });
    }

    let result;
    try {
      result = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));
    } catch (err) {
      return NextResponse.json({ error: 'Failed to parse duplicate finder output' }, { status: 500 });
    } finally {
      try { fs.unlinkSync(outputJson); } catch {}
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      duplicateCount: result.duplicateCount || 0,
      action: result.action || action,
      groups: result.groups || [],
      skipped: result.skipped || false
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
