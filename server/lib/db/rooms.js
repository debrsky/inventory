const config = require('../../../config.js');
const fs = require('fs');
const path = require('path');

const writeFileAtomic = require('write-file-atomic');


const DB_DIR = config.dbDir;
const ROOMS_DIR = path.join(DB_DIR, 'ROOMS');
const ROOMS_CACHE_DIR = path.join(DB_DIR, 'CACHE/ROOMS');
const INFO_FILE = 'info.json';
const INFO_ARCHIVE_DIR = 'ARCHIVE';


const { getCurrentDateTimeFormatted } = require('../utils/helpers.js');
const { areInfoObjectsEqual } = require('../utils/helpers.js');

const resize = require('../utils/ffmpeg.js');

async function getRoomsStructure() {
  function preparePath(path) {
    return path.slice(ROOMS_DIR.length).replace(/\\/g, '/');
  }

  /**
   * Функция для загрузки структуры каталогов.
   * @param {string} dir - Путь к начальному каталогу.
   * @returns {Promise<Object>} - Возвращает объект, представляющий структуру каталогов.
   */
  async function loadDirectoryStructure(dir) {
    const result = {
      name: path.basename(dir),
      path: preparePath(dir),
      children: []
    };

    const items = await fs.promises.readdir(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        // Если элемент - каталог, рекурсивно загружаем его структуру
        result.children.push(await loadDirectoryStructure(fullPath));
      } else {
        // Если элемент - файл, просто добавляем его в список
        if (!result.files) result.files = [];
        result.files.push({ name: item, path: preparePath(fullPath) });
      }
    }

    return result;
  }

  const structure = await loadDirectoryStructure(ROOMS_DIR);

  return structure;
}
/**
 * Retrieves the path to a preview file for a given original file.
 * If the preview file does not already exist, it attempts to create it
 * by resizing the original file into the preview format.
 *
 * @async
 * @function getPathToPreviewFile
 * @param {string} file - The name or path of the original file for which to generate the preview.
 * @returns {Promise<string>} - A promise that resolves to the path of the preview file.
 * @throws {Error} - Throws an error if the original file does not exist or if an error occurs during the resizing process.
 *
 * @example
 * getPathToPreviewFile('example.jpg')
 *   .then(previewPath => {
 *     console.log('Preview generated at:', previewPath);
 *   })
 *   .catch(error => {
 *     console.error('Error generating preview:', error);
 *   });
 */
async function getPathToPreviewFile(file) {
  const pathToFile = path.resolve(path.join(ROOMS_CACHE_DIR, file));
  const dir = path.dirname(pathToFile);

  try {
    await fs.promises.access(pathToFile);
  } catch (err) {
    if (err.code !== 'ENOENT') throw Error(err);

    const pathToOriginalFile = path.resolve(path.join(ROOMS_DIR, file));
    await fs.promises.access(pathToOriginalFile);
    await fs.promises.mkdir(dir, { recursive: true });
    try {
      await resize(pathToOriginalFile, pathToFile);
    } catch (err) {
      throw Error('ffmpeg error', { cause: err });
    }
  }

  return pathToFile;
}
/**
 * Retrieves the resolved file path for a given file within the rooms directory.
 *
 * This function constructs the absolute path based on the provided filename,
 * checks if the file exists, and returns the path in a normalized format 
 * (using forward slashes).
 *
 * @async
 * @param {string} file - The name of the file for which to retrieve the path.
 * @returns {Promise<string>} The absolute path to the specified file.
 * @throws {Error} Will throw an error if the file does not exist or if 
 *                 there are issues accessing the file.
 */
async function getPathToFile(file) {
  const pathToFile = path
    .resolve(path.join(ROOMS_DIR, file))
    .replace(/\\/g, '/');
  await fs.promises.access(pathToFile);
  return pathToFile;
}

async function getRoom(room) {
  const pathToRoom = path.resolve(path.join(ROOMS_DIR, room));
  const pathToInfo = path.resolve(path.join(pathToRoom, INFO_FILE));

  await fs.promises.access(pathToRoom);

  const files = (
    await fs.promises.readdir(pathToRoom, { withFileTypes: true })
  )
    .filter((file) => !file.isDirectory())
    .map((el) => el.name);

  let info;
  try {
    info = JSON.parse(await fs.promises.readFile(pathToInfo, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;

    info = null;
  }

  return { path: room, info, files };

}

async function writeInfo(roomPath, info) {
  const timestamp = getCurrentDateTimeFormatted();
  info.date = timestamp;

  const dir = path.join(ROOMS_DIR, roomPath);
  const archiveDir = path.join(dir, INFO_ARCHIVE_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  const pathToFile = path.join(dir, INFO_FILE);

  let infoOld;
  try {
    infoOld = JSON.parse(await fs.promises.readFile(pathToFile, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (infoOld && areInfoObjectsEqual(infoOld, info)) return;

  //TODO Come up with a method to store the archive
  // if (infoOld) {
  //   // TODO analyze what will happen if multiple clients try to simultaneously save changes to info.json
  //   const extname = path.extname(INFO_FILE);
  //   const basename = path.basename(INFO_FILE, extname);
  //   const archiveFileName = `${basename}.${timestamp}${extname}`;
  //   const pathToArchiveFile = path.join(archiveDir, archiveFileName);
  //   await fs.promises.mkdir(archiveDir, { recursive: true });
  //   await fs.promises.copyFile(pathToFile, pathToArchiveFile);
  // }

  await writeFileAtomic(pathToFile, JSON.stringify(info, null, 4));
}


module.exports = {
  ROOMS_DIR,
  getRoomsStructure,
  getPathToPreviewFile,
  getPathToFile,
  getRoom,
  writeInfo
};
