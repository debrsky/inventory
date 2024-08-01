const config = require('../../../config.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = config.dbDir;
const ROOMS_DIR = path.join(DB_DIR, 'ROOMS');
const ROOMS_CACHE_DIR = path.join(DB_DIR, 'CACHE/ROOMS');

const resize = require('../utils/ffmpeg.js');

async function getRoomsStructure() {
  function preparePath(path) {
    return path.slice(DB_DIR.length).replace(/\\/g, '/');
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
 * Retrieves the path to a preview file for a specific item.
 * If the preview file does not exist, it attempts to create it from the original file.
 * @async
 * @function getPathToPreviewFile
 * @param {string} id - The ID of the item.
 * @param {string} file - The name of the file to retrieve.
 * @returns {Promise<string>} The resolved path to the preview file.
 * @throws {Error} If the file does not exist or if there is an error during resizing.
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
 * Retrieves the path to a specific file within an item's directory.
 * @async
 * @function getPathToFile
 * @param {string} id - The ID of the item.
 * @param {string} file - The name of the file to retrieve.
 * @returns {Promise<string>} The resolved path to the file.
 * @throws {Error} If the file does not exist.
 */
async function getPathToFile(file) {
  const pathToFile = path
    .resolve(path.join(ROOMS_DIR, file))
    .replace(/\\/g, '/');
  await fs.promises.access(pathToFile);
  return pathToFile;
}

module.exports = {
  ROOMS_DIR,
  getRoomsStructure,
  getPathToPreviewFile,
  getPathToFile
};
