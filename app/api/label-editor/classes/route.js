import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getInstanceByName, getInstanceByDatasetPath } from '@/lib/db';
import { getDatasetById, getDatasetByPath, getJobById } from '@/lib/db-datasets';
import { withApiLogging } from '@/lib/api-logger';
import { isPathInDatasetBase } from '@/lib/manager';

export const dynamic = 'force-dynamic';

const DEFAULT_CLASSES = ['one', 'two', 'three', 'four', 'five', 'six', 'invalid'];

function readClassesFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').map((line) => line.trim()).filter(Boolean);
}

export const GET = withApiLogging(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const datasetId = searchParams.get('datasetId');
    const instanceName = searchParams.get('instanceName');
    const basePath = searchParams.get('basePath');
    // classFile param kept for legacy but classFile path never returned in response

    // Mode 1: jobId — look up dataset via job
    if (jobId) {
      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ classes: DEFAULT_CLASSES, source: 'default' });
      const dataset = await getDatasetById(job.datasetId);
      if (dataset?.classFile) {
        const classes = readClassesFromFile(dataset.classFile);
        if (classes.length > 0) return NextResponse.json({ classes, source: 'dataset' });
      }
      return NextResponse.json({ classes: DEFAULT_CLASSES, source: 'default' });
    }

    // Mode 2: datasetId — direct dataset lookup
    if (datasetId) {
      const dataset = await getDatasetById(Number(datasetId));
      if (dataset?.classFile) {
        const classes = readClassesFromFile(dataset.classFile);
        if (classes.length > 0) return NextResponse.json({ classes, source: 'dataset' });
      }
      return NextResponse.json({ classes: DEFAULT_CLASSES, source: 'default' });
    }

    // Mode 3: instanceName — legacy instance lookup
    if (instanceName) {
      const inst = await getInstanceByName(instanceName);
      if (inst?.classFile) {
        const classes = readClassesFromFile(inst.classFile);
        if (classes.length > 0) return NextResponse.json({ classes, source: 'instance' });
      }
      return NextResponse.json({ classes: DEFAULT_CLASSES, source: 'default' });
    }

    // Mode 4: basePath — legacy path-based lookup
    if (basePath) {
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

      for (const cand of baseCandidates) {
        const dataset = await getDatasetByPath(cand);
        if (dataset?.classFile) {
          const classes = readClassesFromFile(dataset.classFile);
          if (classes.length > 0) return NextResponse.json({ classes, source: 'dataset' });
        }
        const instance = await getInstanceByDatasetPath(cand);
        if (instance?.classFile) {
          const classes = readClassesFromFile(instance.classFile);
          if (classes.length > 0) return NextResponse.json({ classes, source: 'instance' });
        }
      }
    }

    return NextResponse.json({ classes: DEFAULT_CLASSES, source: 'default' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
