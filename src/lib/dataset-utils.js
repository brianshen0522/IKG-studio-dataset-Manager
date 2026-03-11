import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tif', '.tiff']);

/**
 * Scan the images/ subdirectory of a dataset path and return sorted filenames.
 * Sort is lexicographic (filename only, not full path).
 */
export function scanImageFilenames(datasetPath) {
  const imagesDir = path.join(datasetPath, 'images');
  if (!fs.existsSync(imagesDir)) return [];

  return fs
    .readdirSync(imagesDir)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort(); // lexicographic — consistent job boundary across runs
}

/**
 * Given total image count and job size, return an array of job descriptors.
 * Indices are 1-based.
 *
 * Example: 8000 images, jobSize 500 → 16 jobs
 *   { jobIndex: 1, imageStart: 1,    imageEnd: 500  }
 *   { jobIndex: 2, imageStart: 501,  imageEnd: 1000 }
 *   ...
 *   { jobIndex: 16, imageStart: 7501, imageEnd: 8000 }
 */
export function computeJobRanges(totalImages, jobSize) {
  if (totalImages === 0 || jobSize < 1) return [];

  const jobs = [];
  let jobIndex = 1;
  for (let start = 1; start <= totalImages; start += jobSize) {
    const end = Math.min(start + jobSize - 1, totalImages);
    jobs.push({ jobIndex, imageStart: start, imageEnd: end });
    jobIndex++;
  }
  return jobs;
}

/**
 * Given a job (imageStart, imageEnd) and the sorted filename list,
 * return the filenames that belong to this job.
 * Legacy index-based fallback — use getJobFilenamesByName when available.
 */
export function getJobFilenames(sortedFilenames, imageStart, imageEnd) {
  return sortedFilenames.slice(imageStart - 1, imageEnd);
}

/**
 * Given anchor filenames (first and last image names recorded at job creation)
 * and the current sorted filename list, return all filenames in the lexicographic
 * range [firstName, lastName] inclusive.
 *
 * This is resilient to deletions: if the boundary image itself was removed,
 * the range is still correctly bounded by name comparison, so the count
 * reflects however many images remain within that original range.
 */
export function getJobFilenamesByName(sortedFilenames, firstName, lastName) {
  return sortedFilenames.filter((f) => f >= firstName && f <= lastName);
}

/**
 * Scan the dataset once and attach a live `currentImageCount` to each job.
 *
 * Jobs with name anchors (first_image_name / last_image_name) use a
 * name-range filter so deletions of any image — including boundary images —
 * are reflected correctly.
 *
 * Legacy jobs without anchors fall back to the static DB range math.
 */
export function annotateJobsWithImageCount(datasetPath, jobs) {
  const allFilenames = scanImageFilenames(datasetPath);
  return jobs.map((job) => {
    const count =
      job.firstImageName && job.lastImageName
        ? allFilenames.filter((f) => f >= job.firstImageName && f <= job.lastImageName).length
        : job.imageEnd - job.imageStart + 1;
    return { ...job, currentImageCount: count };
  });
}
