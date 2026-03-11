import fs from 'fs';
import path from 'path';
import { scanImageFilenames, getJobFilenames, getJobFilenamesByName } from './dataset-utils.js';

function normalizeFolderPath(folderPath) {
  return (folderPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
}

function toLabelRelativePath(imageRelativePath) {
  return imageRelativePath
    .replace(/\/images\//, '/labels/')
    .replace(/^images\//, 'labels/')
    .replace(/\.[^.]+$/i, '.txt');
}

export function getJobImageFilenames(datasetPath, job) {
  const allFilenames = scanImageFilenames(datasetPath);
  if (job.firstImageName && job.lastImageName) {
    return getJobFilenamesByName(allFilenames, job.firstImageName, job.lastImageName);
  }
  return getJobFilenames(allFilenames, job.imageStart, job.imageEnd);
}

export function buildJobEditorPaths(datasetPath, job, folderPath = 'images') {
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  const filenames = getJobImageFilenames(datasetPath, job);
  const imagePaths = filenames.map((filename) =>
    normalizedFolderPath ? path.posix.join(normalizedFolderPath, filename) : filename
  );
  const labelPaths = imagePaths.map(toLabelRelativePath);

  return {
    filenames,
    imagePaths,
    imagePathSet: new Set(imagePaths),
    labelPaths,
    labelPathSet: new Set(labelPaths)
  };
}

export function scanFolderImagePaths(basePath, folderPath = 'images') {
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  const rootPath = normalizedFolderPath ? path.join(basePath, normalizedFolderPath) : basePath;
  const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.gif']);
  const imagePaths = [];
  const imageMeta = {};

  if (!fs.existsSync(rootPath)) {
    return { imagePaths, imagePathSet: new Set(), imageMeta };
  }

  function walk(dirPath) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullItemPath = path.join(dirPath, item);
      const stat = fs.statSync(fullItemPath);
      if (stat.isDirectory()) {
        walk(fullItemPath);
        continue;
      }
      if (!stat.isFile()) continue;

      const ext = path.extname(item).toLowerCase();
      if (!imageExtensions.has(ext)) continue;

      const relativePath = path.relative(rootPath, fullItemPath).replace(/\\/g, '/');
      const imagePath = normalizedFolderPath ? path.posix.join(normalizedFolderPath, relativePath) : relativePath;
      imagePaths.push(imagePath);
      imageMeta[imagePath] = {
        ctimeMs: stat.birthtimeMs || stat.ctimeMs,
        mtimeMs: stat.mtimeMs
      };
    }
  }

  walk(rootPath);
  imagePaths.sort();

  return {
    imagePaths,
    imagePathSet: new Set(imagePaths),
    imageMeta
  };
}

export function isJobImagePathAllowed(imagePath, allowedImagePathSet) {
  return typeof imagePath === 'string' && allowedImagePathSet.has(imagePath.replace(/\\/g, '/'));
}

export function isJobLabelPathAllowed(labelPath, allowedLabelPathSet) {
  return typeof labelPath === 'string' && allowedLabelPathSet.has(labelPath.replace(/\\/g, '/'));
}
