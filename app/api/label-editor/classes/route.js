import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getInstanceByName, getInstanceByDatasetPath } from '@/lib/db';
import { getDatasetByPath } from '@/lib/db-datasets';
import { withApiLogging } from '@/lib/api-logger';
import { isPathInDatasetBase } from '@/lib/manager';

export const dynamic = 'force-dynamic';

function readClassesFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').map((line) => line.trim()).filter(Boolean);
}

export const GET = withApiLogging(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const basePath = searchParams.get('basePath');
    const instanceName = searchParams.get('instanceName');
    const classFile = searchParams.get('classFile');
    const defaultClasses = ['one', 'two', 'three', 'four', 'five', 'six', 'invalid'];

    if (classFile) {
      if (!isPathInDatasetBase(classFile)) {
        return NextResponse.json({ error: 'Path is outside dataset base path' }, { status: 400 });
      }
      const classes = readClassesFromFile(classFile);
      if (classes.length > 0) {
        return NextResponse.json({ classes, source: 'classFile', classFile });
      }
      return NextResponse.json({ classes: defaultClasses, source: 'default' });
    }

    // Direct lookup by instance name — no ambiguity
    if (instanceName) {
      const inst = await getInstanceByName(instanceName);
      if (inst && inst.classFile) {
        const classes = readClassesFromFile(inst.classFile);
        if (classes.length > 0) {
          return NextResponse.json({ classes, source: 'classFile', classFile: inst.classFile });
        }
      }
      return NextResponse.json({ classes: defaultClasses, source: 'default' });
    }

    if (!basePath) {
      return NextResponse.json({ classes: defaultClasses, source: 'default' });
    }

    const normalizedBase = path.resolve(basePath);
    const baseCandidates = new Set([normalizedBase]);
    if (fs.existsSync(normalizedBase)) {
      baseCandidates.add(fs.realpathSync(normalizedBase));
    }
    [normalizedBase, ...baseCandidates].forEach((candidate) => {
      if (candidate.endsWith(`${path.sep}images`)) {
        baseCandidates.add(candidate.slice(0, -(`${path.sep}images`).length));
      }
      if (candidate.endsWith(`${path.sep}labels`)) {
        baseCandidates.add(candidate.slice(0, -(`${path.sep}labels`).length));
      }
    });

    let instance = null;
    let dataset = null;
    for (const cand of baseCandidates) {
      dataset = await getDatasetByPath(cand);
      if (dataset?.classFile) {
        const classes = readClassesFromFile(dataset.classFile);
        if (classes.length > 0) {
          return NextResponse.json({ classes, source: 'datasetClassFile', classFile: dataset.classFile });
        }
      }

      instance = await getInstanceByDatasetPath(cand);
      if (instance) {
        break;
      }
    }

    if (!instance || !instance.classFile) {
      return NextResponse.json({ classes: defaultClasses, source: 'default' });
    }

    const classes = readClassesFromFile(instance.classFile);

    if (classes.length === 0) {
      return NextResponse.json({ classes: defaultClasses, source: 'default' });
    }

    return NextResponse.json({ classes, source: 'classFile', classFile: instance.classFile });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
