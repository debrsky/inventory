const config = require('../../../config.js');

const { pipeline } = require('stream');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const createError = require('http-errors')

const tempdir = os.tmpdir();
const multer = require('multer');
// https://github.com/expressjs/multer/issues/1104
const multerMonkeyPatch = (files) => {
  for (key in files) {
    files[key].forEach(file => {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf-8');
    })
  }
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempdir);
  },
  filename: function (req, file, cb) {
    const tempfname = crypto.randomUUID();
    cb(null, tempfname);
  }
});
const upload = multer({ storage: storage });

const PICTURE_FILE_TYPES = config.pictureFileTypes;

const send = require('send');
send.mime.define({
  'image/avif': ['avif']
});

const express = require('express');
const router = express.Router();

const db = require('../../lib/db/index.js');

router.use((req, res, next) => {
  res.locals.baseUrl = req.baseUrl;
  res.locals.PICTURE_FILE_TYPES = PICTURE_FILE_TYPES;
  next();
})

router.get('/', async (req, res) => {
  const rooms = await db.rooms.getRoomsStructure();

  res.render('rooms/index', { rooms });
});

router.get(['/:path', '/:path/edit'], async (req, res, next) => {
  const mode = req.url.endsWith('/edit') ? 'edit' : 'view';

  const roomPath = req.params.path;
  let room, items;
  try {
    room = await db.rooms.getRoom(roomPath);
    items = await db.items.getItemsByRoom(room.info.id);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }

  const issues = db.rooms.ISSUES;
  const params = db.rooms.PARAMS;
  res.render('rooms/room', { room, mode, items, params, issues });
});

router.post('/:path', async (req, res, next) => {
  const roomPath = req.params.path;
  let room;
  try {
    room = await db.rooms.getRoom(roomPath);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }

  if (!req.is('multipart/form-data')) return next(createError(415));

  upload.fields([{ name: "image" }, { name: "file" }])(req, res, async (err) => {
    if (err) return next(err);

    const info = req.body.info;

    try {
      await db.rooms.writeInfo(roomPath, info);
    } catch (err) {
      return next(err);
    }

    const filesToDelete = [req.body.imagestodelete, req.body.filestodelete].flat().filter(el => !!el);
    if (filesToDelete.length > 0) {
      const deleteTasks = filesToDelete.map(file => {
        const pathToImageFile = path.join(db.rooms.ROOMS_DIR, roomPath, file);
        const executor = (resolve, reject) => {
          fs.unlink(pathToImageFile, (err) => {
            if (err) return reject(err);
            resolve();
          })
        }
        return new Promise(executor);
      });

      try {
        await Promise.all(deleteTasks);
      } catch (err) {
        return next(err);
      }
    }

    if (Object.keys(req.files).length > 0) {
      multerMonkeyPatch(req.files);
      const uploadedFiles = [req.files.image, req.files.file].flat().filter(file => !!file);

      console.log(uploadedFiles);

      const calcHashTasks = uploadedFiles.map(file => {
        const executor = (resolve, reject) => {
          const hash = crypto.createHash('md5');
          const stream = fs.createReadStream(file.path);

          pipeline(
            stream,
            hash,
            (err) => {
              if (err) {
                reject(err);
              } else {
                file.hash = hash.digest('base64url');
                resolve(file);
              }
            }
          );
        }

        return new Promise(executor);
      });

      let files;
      try {
        files = await Promise.all(calcHashTasks);
      } catch (err) {
        return next(err)
      }

      const copyTasks = files.map(file => {
        const extname = path.extname(file.originalname);
        const basename = path.basename(file.originalname, extname);
        const pathToFile = path.join(db.rooms.ROOMS_DIR, roomPath, `${basename}.${file.hash}${extname}`);
        const executor = (resolve, reject) => {
          fs.copyFile(file.path, pathToFile, (err) => {
            if (err) return reject(err);
            fs.unlink(file.path, (err) => {
              if (err) return reject(err);
              resolve(pathToFile);
            })
          })
        };
        return new Promise(executor);
      });

      let filesCopied;
      try {
        filesCopied = await Promise.all(copyTasks);
      } catch (err) {
        if (err) return next(err);
      }
      console.log({ filesCopied });
    }

    // return res.send("Ok");
    return res.redirect(req.originalUrl);
  });
});

router.get('/:path/:file', async (req, res, next) => {
  if (!/\.[a-zA-Z0-9]+$/.test(req.params.file)) return next();

  const fileUrl = `${req.params.path}/${req.params.file}`;

  try {
    const pathToFile = await db.rooms.getPathToFile(fileUrl);

    const stream = send(req, pathToFile).on('error', (err) => {
      if (err.code === 'ENOENT') return next();
      return next(err);
    });

    stream.pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }
});

router.get('/preview/:path/:file', async (req, res, next) => {
  const fileUrl = `${req.params.path}/${req.params.file}`;

  const fileLowerCase = req.params.file.toLowerCase();
  if (
    !PICTURE_FILE_TYPES.some((ext) =>
      fileLowerCase.endsWith(`.${ext}`)
    )
  ) {
    return next();
  }

  const pathToFile = fileUrl;

  try {
    const pathToPreviewFile = await db.rooms.getPathToPreviewFile(pathToFile);

    const stream = send(req, pathToPreviewFile).on('error', (err) => {
      if (err.code === 'ENOENT') return next();
      return next(err);
    });

    stream.pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }
});

module.exports = router;
