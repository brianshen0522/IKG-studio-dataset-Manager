import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '@/lib/api-logger';
import { getUserFromRequest } from '@/lib/auth';
import { getDatasetById, getJobById } from '@/lib/db-datasets';
import { buildJobEditorPaths, scanFolderImagePaths } from '@/lib/job-scope';
import { canAccessJob } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function applyLabelFilters(labelContent, filters) {
  const { selectedClasses, minLabels, maxLabels, classMode, classLogic } = filters || {};
  const resolvedClassMode = classMode || 'any';
  const resolvedClassLogic = classLogic || 'any';
  const max = maxLabels !== undefined && maxLabels !== null ? maxLabels : Infinity;
  const min = minLabels || 0;

  const lines = labelContent.trim().split('\n').filter((line) => line.trim());
  const annotations = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const classId = parseInt(parts[0], 10);
      if (!Number.isNaN(classId)) annotations.push(classId);
    }
  }

  const count = annotations.length;
  const classes = [...new Set(annotations)];

  if (count < min || count > max) return false;

  if (resolvedClassMode === 'none') {
    return count === 0;
  } else if (resolvedClassMode === 'only') {
    if (!selectedClasses || selectedClasses.length === 0) return false;
    const hasOnlySelected = classes.every((cls) => selectedClasses.includes(cls));
    if (!hasOnlySelected) return false;
    if (resolvedClassLogic === 'all') return selectedClasses.every((cls) => classes.includes(cls));
    return selectedClasses.some((cls) => classes.includes(cls));
  } else if (selectedClasses && selectedClasses.length > 0) {
    if (resolvedClassLogic === 'all') return selectedClasses.every((cls) => classes.includes(cls));
    return selectedClasses.some((cls) => classes.includes(cls));
  }
  return true;
}

export const POST = withApiLogging(async (req) => {
  try {
    const body = await req.json();
    const { basePath, images, imageNames, filters, jobId, view } = body;

    const { nameFilter, selectedClasses, minLabels, maxLabels, classMode, classLogic } = filters || {};
    const needsLabelCheck = selectedClasses?.length > 0 || minLabels > 0 ||
      (maxLabels !== undefined && maxLabels !== null && maxLabels < Infinity) ||
      (classMode && classMode !== 'any');

    // Job-based mode: { jobId, imageNames, filters }
    if (jobId && imageNames) {
      const actor = await getUserFromRequest(req);
      if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const job = await getJobById(Number(jobId));
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      if (!canAccessJob(actor, job)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const dataset = await getDatasetById(job.datasetId);
      if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

      const folder = view === 'duplicates' ? 'duplicate/images' : 'images';
      const { imagePathSet } = view === 'duplicates'
        ? scanFolderImagePaths(dataset.datasetPath, folder)
        : buildJobEditorPaths(dataset.datasetPath, job, folder);

      const allowedNames = imageNames.filter((n) => imagePathSet.has(`${folder}/${n}`));
      const filteredImages = [];

      for (const name of allowedNames) {
        if (nameFilter && nameFilter.trim() && !name.toLowerCase().includes(nameFilter.toLowerCase().trim())) {
          continue;
        }

        if (needsLabelCheck) {
          const labelName = name.replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
          const labelFolder = folder.replace('images', 'labels');
          const fullLabelPath = path.join(dataset.datasetPath, labelFolder, labelName);
          let labelContent = '';
          if (fs.existsSync(fullLabelPath)) labelContent = fs.readFileSync(fullLabelPath, 'utf-8');
          if (!applyLabelFilters(labelContent, filters)) continue;
        }

        filteredImages.push(name);
      }

      return NextResponse.json({ filteredImages, totalCount: imageNames.length, filteredCount: filteredImages.length });
    }

    // Legacy path-based mode: { basePath, images, filters }
    if (!basePath || !images || !Array.isArray(images)) {
      return NextResponse.json({ error: 'Missing basePath or images array' }, { status: 400 });
    }

    const filteredImages = [];

    for (const imagePath of images) {
      if (nameFilter && nameFilter.trim() && !imagePath.toLowerCase().includes(nameFilter.toLowerCase().trim())) {
        continue;
      }

      if (needsLabelCheck) {
        const labelPath = imagePath
          .replace('images/', 'labels/')
          .replace(/\.(jpg|jpeg|png|bmp|gif)$/i, '.txt');
        const fullLabelPath = path.join(basePath, labelPath);
        let labelContent = '';
        if (fs.existsSync(fullLabelPath)) labelContent = fs.readFileSync(fullLabelPath, 'utf-8');
        if (!applyLabelFilters(labelContent, filters)) continue;
      }

      filteredImages.push(imagePath);
    }

    return NextResponse.json({ filteredImages, totalCount: images.length, filteredCount: filteredImages.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
