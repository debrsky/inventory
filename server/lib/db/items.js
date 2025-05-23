const config = require('../../../config.js');
const STORAGE = process.env.STORAGE;
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const writeFileAtomic = require('write-file-atomic');

const { getCurrentDateTimeFormatted } = require('../utils/helpers.js');
const { areInfoObjectsEqual } = require('../utils/helpers.js');

const resize = require('../utils/ffmpeg.js');
const { parseReport } = require('../utils/aida64.js');

const DB_DIR = path.join(STORAGE, 'DB');
const CACHE_DIR = path.join(DB_DIR, 'CACHE');
const ITEMS_DIR = path.join(DB_DIR, 'ITEMS');
const INFO_FILE = 'info.json';
const INFO_ARCHIVE_DIR = 'ARCHIVE';
const PC_FILE = 'pc.json';
const REPORT_FILE = 'Report.htm';

const COMP_TYPES = ['pc', 'aio', 'laptop', 'nbk', 'mbl', 'monoblock'];

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`current timezone: ${timezone}`);

/**
 * Regular expression to validate item IDs.
 * IDs should be exactly four digits long.
 * @type {RegExp}
 */
const ID_SCHEMA = /^\d\d\d\d$/;

/**
 * Validates an item ID against the defined schema.
 * @param {string} id - The ID to validate.
 * @returns {boolean} True if the ID is valid, false otherwise.
 */
function isIdValid(id) {
  return ID_SCHEMA.test(id);
}

/**
 * Retrieves a list of items from the ITEMS_DIR directory.
 * Each item is represented by its ID and corresponding info from the INFO_FILE.
 * @async
 * @function getItems
 * @returns {Promise<Array<Object>>} An array of objects, each containing an item's ID and info.
 */
async function getItems() {
  await fs.promises.mkdir(ITEMS_DIR, { recursive: true });

  const ids = (await fs.promises.readdir(ITEMS_DIR, { withFileTypes: true }))
    .filter((file) => file.isDirectory() && ID_SCHEMA.test(file.name))
    .map((el) => el.name);

  const items = (
    await Promise.allSettled(
      ids.map((id) =>
        fs.promises.readFile(path.join(ITEMS_DIR, id, INFO_FILE), 'utf8')
      )
    )
  ).map((res, idx) => {
    if (res.status === 'rejected' && res.reason.code !== 'ENOENT')
      throw res.reason;
    if (res.status === 'rejected') return { id: ids[idx] };

    // res.status === "fulfilled"
    const info = JSON.parse(res.value);
    const tags = (info.comment ?? '').match(/#\S+/g) ?? [];

    return { id: ids[idx], ...info, tags };
  });

  return items;
}

async function getItemsByRoom(room) {
  const items = (await getItems()).filter(item => item.place === room);
  const itemsFull = await Promise.all(items.map((item) => getItem(item.id)));
  // console.log({ room, items });
  return itemsFull;
}

/**
 * Retrieves detailed information about a specific item by its ID.
 * @async
 * @function getItem
 * @param {string} id - The ID of the item to retrieve.
 * @returns {Promise<Object>} An object containing the item's ID, detailed info, and list of files.
 */
async function getItem(id) {
  const files = (
    await fs.promises.readdir(path.join(ITEMS_DIR, id), { withFileTypes: true })
  )
    .filter((file) => !file.isDirectory())
    .map((el) => el.name);

  const infoPath = path.join(ITEMS_DIR, id, INFO_FILE);
  let info;
  try {
    info = { type: '', brand: '', model: '', place: '', comment: '' };
    Object.assign(
      info,
      JSON.parse(await fs.promises.readFile(infoPath, 'utf8'))
    );
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  let pc;

  if (COMP_TYPES.includes(info.type.toLowerCase())) {
    const pcPath = path.join(ITEMS_DIR, id, PC_FILE);
    try {
      pc = { cpu: '', ram: '', mb: '', drives: [] };
      Object.assign(pc, JSON.parse(await fs.promises.readFile(pcPath, 'utf8')));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;

      try {
        pc = await getReportData(id);
        await writeFileAtomic(pcPath, JSON.stringify(pc));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
  }

  return { id, info, files, pc };
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
async function getPathToFile(id, file) {
  const pathToFile = path
    .resolve(path.join(ITEMS_DIR, id, file))
    .replace(/\\/g, '/');
  await fs.promises.access(pathToFile, fs.constants.F_OK);
  return pathToFile;
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
async function getPathToPreviewFile(id, file) {
  const dir = path.resolve(path.join(CACHE_DIR, id));
  const pathToFile = path.resolve(path.join(dir, file));

  try {
    await fs.promises.access(pathToFile, fs.constants.F_OK);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;

    const pathToOriginalFile = path.resolve(path.join(ITEMS_DIR, id, file));
    await fs.promises.access(pathToOriginalFile, fs.constants.F_OK);
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
 * Adds a specified number of new IDs to the ITEMS_DIR directory.
 * @async
 * @function addIds
 * @param {number} count - The number of new IDs to add.
 * @returns {Promise<void>} A promise that resolves when all new IDs have been added.
 */
async function addIds(count) {
  const ids = (await fs.promises.readdir(ITEMS_DIR, { withFileTypes: true }))
    .filter((file) => file.isDirectory() && ID_SCHEMA.test(file.name))
    .map((el) => Number(el.name));

  const lastId = ids.reduce((max, cur) => (cur > max ? cur : max), 1000);

  const newIds = Array.from({ length: count }, (_, i) =>
    (lastId + 1 + i).toString()
  );

  await Promise.all(
    newIds.map((newId) =>
      fs.promises.mkdir(path.join(ITEMS_DIR, newId), { recursive: true })
    )
  );
}

/**
 * Removes a specified file from an item's directory.
 * @async
 * @function removeFile
 * @param {string} id - The ID of the item.
 * @param {string} file - The name of the file to remove.
 * @returns {Promise<void>} A promise that resolves when the file has been removed.
 * @throws {Error} If there is an error during the removal process.
 */
async function removeFile(id, file) {
  const pathToFile = path.join(ITEMS_DIR, id, file);
  try {
    await fs.promises.unlink(pathToFile);
    // TODO: Implement the removal of cached preview files
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Creates a writable stream for writing a file to a specified item's directory.
 * The file is first written to a temporary location and then moved to the final destination upon completion.
 * @async
 * @function createWriteFileStream
 * @param {string} id - The ID of the item.
 * @param {string} file - The name of the file to write.
 * @returns {Promise<fs.WriteStream>} A writable stream for the file.
 * @throws {Error} If there is an error during the file writing process.
 */
async function createWriteFileStream(id, file) {
  const tempdir = os.tmpdir();
  const tempfname = crypto.randomUUID();

  const dir = path.join(ITEMS_DIR, id);
  await fs.promises.mkdir(dir, { recursive: true });
  const pathToFile = path.join(dir, file);

  const pathToTempFile = path.join(tempdir, tempfname);
  const ws = fs.createWriteStream(pathToTempFile).on('finish', () => {
    fs.copyFile(pathToTempFile, pathToFile, (err) => {
      if (err) return console.error(err);
      fs.unlink(pathToTempFile, (err) => console.error(err));
    });
  });

  return ws;
}
/**
 * Writes information to a specified item's directory.
 * The information is written to a file named INFO_FILE in JSON format.
 * @async
 * @function writeInfo
 * @param {string} id - The ID of the item.
 * @param {Object} info - The information to write.
 * @returns {Promise<void>} A promise that resolves when the information has been written.
 * @throws {Error} If there is an error during the writing process.
 */
async function writeInfo(id, info) {
  const timestamp = getCurrentDateTimeFormatted();
  info.date = timestamp;

  const dir = path.join(ITEMS_DIR, id);
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

  if (infoOld) {
    // TODO analyze what will happen if multiple clients try to simultaneously save changes to info.json
    const extname = path.extname(INFO_FILE);
    const basename = path.basename(INFO_FILE, extname);
    const archiveFileName = `${basename}.${timestamp}${extname}`;
    const pathToArchiveFile = path.join(archiveDir, archiveFileName);
    await fs.promises.mkdir(archiveDir, { recursive: true });
    await fs.promises.copyFile(pathToFile, pathToArchiveFile);
  }

  // TODO validate info
  await writeFileAtomic(pathToFile, JSON.stringify(info, null, 4));
}

/**
 * Retrieves a sorted list of unique places from the items.
 * @async
 * @function getPlaces
 * @returns {Promise<Array<string>>} A promise that resolves to an array of sorted unique places.
 */
async function getPlaces() {
  const items = await getItems();
  const places = [...new Set(items.map((item) => item.place))];
  return places.sort();
}

/**
 * Retrieves a sorted list of unique tags from the comments of all items.
 *
 * @async
 * @function getTags
 * @returns {Promise<Array<string>>} A promise that resolves to an array of sorted unique tags.
 */
async function getTags() {
  const items = await getItems();
  const tags = [...new Set(items.map((item) => item.tags).flat())];
  return tags.sort();
}

/**
 * Retrieves and parses the report data for a specified item.
 * @async
 * @function getReportData
 * @param {string} id - The ID of the item.
 * @returns {Promise<Object>} A promise that resolves to the parsed report data.
 * @throws {Error} If the report file does not exist or cannot be parsed.
 */
async function getReportData(id) {
  const pathToReportFile = path.join(ITEMS_DIR, id, REPORT_FILE);
  const data = await parseReport(pathToReportFile);

  return data;
}

async function aida64ParseAll(res) {
  const items = await getItems();
  const comps = items.filter(item => COMP_TYPES.includes(item.type?.toLowerCase()));

  for (let i = 0; i < comps.length; ++i) {
    res.write(`${i}/${comps.length}\n`);
    const comp = comps[i];
    const pcPath = path.join(ITEMS_DIR, comp.id, PC_FILE);
    await fs.promises.unlink(pcPath).catch(err => res.write(err.stack));
    const compFullInfo = await getItem(comp.id);
    if (res) {
      res.write(JSON.stringify(compFullInfo, null, 2) + '\n');
    }
  }
}

module.exports = {
  ITEMS_DIR,
  isIdValid,
  getItems,
  getItemsByRoom,
  getItem,
  getPathToFile,
  getPathToPreviewFile,
  addIds,
  removeFile,
  createWriteFileStream,
  writeInfo,
  getPlaces,
  getTags,
  getReportData,
  aida64ParseAll
};
