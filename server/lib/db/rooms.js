const config = require('../../../config.js');
const fs = require('fs');
const path = require('path');

const writeFileAtomic = require('write-file-atomic');

const DB_DIR = config.dbDir;
const ROOMS_DIR = path.join(DB_DIR, 'ROOMS');
const ROOMS_CACHE_DIR = path.join(DB_DIR, 'CACHE/ROOMS');
const INFO_FILE = 'info.json';
const INFO_ARCHIVE_DIR = 'ARCHIVE';

const PARAMS = {
  hasInternet: "Наличие интернета",
  hasProjector: "Наличие проектора",
  hasComputer: "Наличие компьютера",
  hasInteractiveWhiteboard: "Наличие интерактивной доски",
  hasLargeScreenTV: "Наличие телевизора с большим экраном"
};

const ISSUES = {
  wiresOnFloor: "Провода валяются на полу",
  hangingWires: "Провода свисают с потолка петлями",
  imageMismatch: "Проецируемое изображение не соответствует экрану",
  ceilingDirt: "На потолке грязь",
  wallDirt: "На стенах грязь",
  dirtyTapeResidues: "Грязные остатки скотча на доске объявлений",
  ceilingPlasterChips: "На потолке сколы штукатурки",
  plasterCrumbling: "Местами осыпается штукатурка",
  dimProjectedImage: "Проецируемое изображение тусклое",
  noisyProjector: "Проектор при работе сильно шумит",
  excessiveCableLength: "Провода избыточной длины, требуется кабель-менеджмент",
  oldProjectorAge: "Проектор возрастом более 10 лет",
  unusedEquipmentInAuditorium: "Наличие неиспользуемого оборудования в аудитории",
  unusedEquipmentInLab: "Наличие неиспользуемого оборудования в препараторской",
  emptyEquipmentBoxes: "Наличие пустых коробок от оборудования",
  boardHingeBlocked: "Боковые створка аудиторной доски фиксируется кабель-каналом кондиционера",
  ceilingStains: "Потеки на панелях подвесного потолка",
  missingCeilingPanels: "Отсутствуют панели подвесного потолка",
  brokenCeilingPanel: "Сломана панель подвесного потолка",
  saggingCeilingFrame: "Провисает профиль каркаса подвесного потолка",
  rustyCeilingFrame: "Ржавый профиль каркаса подвесного потолка",
  rustyLampInCeiling: "Ржавая лампа в подвесном потолке",
  protectiveFilmResidue: "Остатки защитной пленки на раме пластикового окна",
  ceilingSpitStains: "Плевки на потолке",
  bubbledTabletop: "Вспученная столешница",
  rustyPipeInAuditorium: "Ржавая труба в аудитории"
};

function makeInfo() {
  return {
    id: null,
    comment: '',
    params: [],
    issues: []
  }
}

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
    const roomPath = preparePath(dir);
    const { info, files } = await getRoom(roomPath);

    const result = {
      name: path.basename(dir),
      path: roomPath,
      info,
      files,
      children: []
    };

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === INFO_ARCHIVE_DIR || entry.name === INFO_FILE) continue;

      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        result.children.push(await loadDirectoryStructure(fullPath));
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
    .filter((file) => !file.isDirectory() && file.name !== INFO_FILE)
    .map((el) => el.name);

  let info;
  try {
    info = { ...makeInfo(), ...JSON.parse(await fs.promises.readFile(pathToInfo, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;

    info = makeInfo();
  }

  return { path: room, info, files };

}

async function writeInfo(roomPath, info) {
  const infoToSave = Object.assign(makeInfo(), info);

  const timestamp = getCurrentDateTimeFormatted();
  infoToSave.date = timestamp;

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

  if (infoOld && areInfoObjectsEqual(infoOld, infoToSave)) return;

  if (infoOld) {
    // TODO analyze what will happen if multiple clients try to simultaneously save changes to info.json
    const extname = path.extname(INFO_FILE);
    const basename = path.basename(INFO_FILE, extname);
    const archiveFileName = `${basename}.${timestamp}${extname}`;
    const pathToArchiveFile = path.join(archiveDir, archiveFileName);
    await fs.promises.mkdir(archiveDir, { recursive: true });
    await fs.promises.copyFile(pathToFile, pathToArchiveFile);
  }

  await writeFileAtomic(pathToFile, JSON.stringify(infoToSave, null, 4));
}


module.exports = {
  ROOMS_DIR,
  PARAMS,
  ISSUES,
  getRoomsStructure,
  getPathToPreviewFile,
  getPathToFile,
  getRoom,
  writeInfo
};
