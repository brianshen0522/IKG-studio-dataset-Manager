import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';

export const POST = withApiLogging(async (req) => {
  try {
    const body = await req.json();
    const { labelPath, content, basePath, relativeLabelPath } = body;

    let fullLabelPath = labelPath;
    if (basePath && relativeLabelPath) {
      fullLabelPath = path.join(basePath, relativeLabelPath);
    }

    if (!fullLabelPath) {
      return NextResponse.json({ error: 'Missing label path' }, { status: 400 });
    }

    const labelDir = path.dirname(fullLabelPath);
    if (!fs.existsSync(labelDir)) {
      fs.mkdirSync(labelDir, { recursive: true });
    }

    fs.writeFileSync(fullLabelPath, content || '', 'utf-8');

    return NextResponse.json({ success: true, message: 'Labels saved successfully' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
