import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, isJobImagePathAllowed } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export const POST = withApiLogging(async (req) => {
  try {
    const body = await req.json();
    const { basePath, images, filters, jobId } = body;

    if (!basePath || !images || !Array.isArray(images)) {
      return NextResponse.json({ error: 'Missing basePath or images array' }, { status: 400 });
    }

    let allowedImagePathSet = null;
    if (jobId) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const folderPath = images.find(Boolean)?.replace(/\\/g, '/').split('/').slice(0, -1).join('/') || 'images';
      allowedImagePathSet = buildJobEditorPaths(dataset.datasetPath, job, folderPath).imagePathSet;
    }

    const { nameFilter, selectedClasses, minLabels, maxLabels, classMode, classLogic } = filters || {};
    const resolvedClassMode = classMode || 'any';
    const resolvedClassLogic = classLogic || 'any';

    const filteredImages = [];

    for (const imagePath of images) {
      if (allowedImagePathSet && !isJobImagePathAllowed(imagePath, allowedImagePathSet)) {
        continue;
      }
      let passFilter = true;

      if (nameFilter && nameFilter.trim()) {
        if (!imagePath.toLowerCase().includes(nameFilter.toLowerCase().trim())) {
          passFilter = false;
        }
      }

      const max = maxLabels !== undefined && maxLabels !== null ? maxLabels : Infinity;
      if (
        passFilter &&
        (selectedClasses?.length > 0 || minLabels > 0 || max < Infinity || resolvedClassMode !== 'any')
      ) {
        try {
          const labelPath = imagePath
            .replace('images/', 'labels/')
            .replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
          const fullLabelPath = path.join(basePath, labelPath);

          let labelContent = '';
          if (fs.existsSync(fullLabelPath)) {
            labelContent = fs.readFileSync(fullLabelPath, 'utf-8');
          }

          const lines = labelContent.trim().split('\n').filter((line) => line.trim());
          const annotations = [];

          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              const classId = parseInt(parts[0], 10);
              if (!Number.isNaN(classId)) {
                annotations.push(classId);
              }
            }
          }

          const count = annotations.length;
          const classes = [...new Set(annotations)];

          const min = minLabels || 0;
          if (count < min || count > max) {
            passFilter = false;
          }

          if (passFilter) {
            if (resolvedClassMode === 'none') {
              if (count !== 0) {
                passFilter = false;
              }
            } else if (resolvedClassMode === 'only') {
              if (!selectedClasses || selectedClasses.length === 0) {
                passFilter = false;
              } else {
                const hasOnlySelected = classes.every((cls) => selectedClasses.includes(cls));
                if (!hasOnlySelected) {
                  passFilter = false;
                } else if (resolvedClassLogic === 'all') {
                  const hasAllClasses = selectedClasses.every((cls) => classes.includes(cls));
                  if (!hasAllClasses) {
                    passFilter = false;
                  }
                } else {
                  const hasAnyClass = selectedClasses.some((cls) => classes.includes(cls));
                  if (!hasAnyClass) {
                    passFilter = false;
                  }
                }
              }
            } else if (selectedClasses && selectedClasses.length > 0) {
              if (resolvedClassLogic === 'all') {
                const hasAllClasses = selectedClasses.every((cls) => classes.includes(cls));
                if (!hasAllClasses) {
                  passFilter = false;
                }
              } else {
                const hasAnyClass = selectedClasses.some((cls) => classes.includes(cls));
                if (!hasAnyClass) {
                  passFilter = false;
                }
              }
            }
          }
        } catch (err) {
          const count = 0;
          const min = minLabels || 0;

          if (count < min || count > max) {
            passFilter = false;
          }

          if (passFilter) {
            if (resolvedClassMode === 'none') {
              // Keep passFilter true.
            } else if (resolvedClassMode === 'only') {
              passFilter = false;
            } else if (selectedClasses && selectedClasses.length > 0) {
              passFilter = false;
            }
          }
        }
      }

      if (passFilter) {
        filteredImages.push(imagePath);
      }
    }

    return NextResponse.json({
      filteredImages,
      totalCount: images.length,
      filteredCount: filteredImages.length
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
