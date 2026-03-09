import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  CONFIG,
  checkServiceHealth,
  execPromise,
  validateInstanceNameFormat,
  validatePort
} from '@/lib/manager';
import {
  getAllInstances,
  createInstance,
  updateInstanceFields,
  isNameInUse,
  isPortInUse
} from '@/lib/db';
import { withApiLogging } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';

export const GET = withApiLogging(async () => {
  try {
    const instances = await getAllInstances();

    let pm2List = [];
    try {
      const { stdout } = await execPromise('pm2 jlist');
      pm2List = JSON.parse(stdout);
    } catch (err) {
      pm2List = null;
    }

    for (const instance of instances) {
      try {
        if (!pm2List) {
          throw new Error('Unable to read PM2 list');
        }
        const pm2Process = pm2List.find((process) => process.name === instance.name);

        if (pm2Process) {
          instance.status = pm2Process.pm2_env.status;
          instance.pid = pm2Process.pid;
          instance.uptime = pm2Process.pm2_env.pm_uptime;
          instance.restarts = pm2Process.pm2_env.restart_time;

          if (instance.status === 'online') {
            const healthCheck = await checkServiceHealth(instance.port);
            instance.serviceHealth = healthCheck.healthy ? 'healthy' : 'unhealthy';
            instance.healthDetails = healthCheck;
          } else {
            instance.serviceHealth = 'n/a';
            instance.healthDetails = null;
          }
        } else {
          instance.status = 'stopped';
          instance.pid = null;
          instance.serviceHealth = 'n/a';
          instance.healthDetails = null;
        }

        await updateInstanceFields(instance.name, {
          status: instance.status,
          pid: instance.pid,
          serviceHealth: instance.serviceHealth,
          healthDetails: instance.healthDetails
        });
      } catch (err) {
        instance.status = 'unknown';
        instance.serviceHealth = 'unknown';
        instance.healthDetails = { error: err.message };
      }
    }

    const imageExts = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff', '.tif']);
    for (const instance of instances) {
      try {
        const imagesDir = path.join(instance.datasetPath, 'images');
        if (fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()) {
          instance.imageCount = fs.readdirSync(imagesDir)
            .filter(f => imageExts.has(path.extname(f).toLowerCase())).length;
        } else {
          instance.imageCount = null;
        }
      } catch {
        instance.imageCount = null;
      }
    }

    return NextResponse.json(instances);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withApiLogging(async (req) => {
  try {
    const body = await req.json();
    const {
      name,
      port,
      datasetPath,
      threshold,
      debug,
      pentagonFormat,
      obbMode,
      classFile,
      autoSync,
      duplicateMode
    } = body;

    if (!name || !port || !datasetPath) {
      return NextResponse.json({ error: 'Name, port, and datasetPath are required' }, { status: 400 });
    }

    if (!validateInstanceNameFormat(name)) {
      return NextResponse.json(
        { error: 'Name must use only letters, numbers, hyphens, or underscores' },
        { status: 400 }
      );
    }

    const numericPort = Number(port);
    if (!validatePort(numericPort)) {
      return NextResponse.json(
        { error: `Port must be within range ${CONFIG.portRange.start}-${CONFIG.portRange.end}` },
        { status: 400 }
      );
    }

    if (await isNameInUse(name)) {
      return NextResponse.json({ error: 'Instance name already exists' }, { status: 400 });
    }

    if (await isPortInUse(numericPort)) {
      return NextResponse.json({ error: 'Port already in use' }, { status: 400 });
    }

    const newInstance = await createInstance({
      name,
      port: numericPort,
      datasetPath,
      threshold: threshold !== undefined ? threshold : CONFIG.defaultIouThreshold,
      debug: debug !== undefined ? debug : CONFIG.defaultDebug,
      pentagonFormat: pentagonFormat || false,
      obbMode: obbMode || 'rectangle',
      classFile: classFile || null,
      autoSync: autoSync !== undefined ? autoSync : true,
      duplicateMode: duplicateMode || 'move',
      status: 'stopped',
      createdAt: new Date().toISOString()
    });

    return NextResponse.json(newInstance, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
