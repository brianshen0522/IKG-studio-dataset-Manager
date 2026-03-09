import path from 'path';
import { scanImageFilenames, getJobFilenames } from './dataset-utils.js';

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

export function isJobImagePathAllowed(imagePath, allowedImagePathSet) {
  return typeof imagePath === 'string' && allowedImagePathSet.has(imagePath.replace(/\\/g, '/'));
}

export function isJobLabelPathAllowed(labelPath, allowedLabelPathSet) {
  return typeof labelPath === 'string' && allowedLabelPathSet.has(labelPath.replace(/\\/g, '/'));
}
