const send = require('send');
send.mime.define({
  'image/avif': ['avif']
});

const express = require('express');
const router = express.Router();

const IMAGE_EXTENSIONS = ['jpg', 'png', 'webp', 'avif'];

const db = require('../../lib/db/index.js');

router.use((req, res, next) => {
  res.locals.baseUrl = req.baseUrl;
  next();
})

router.get('/', async (req, res) => {
  const rooms = await db.rooms.getRoomsStructure();

  res.render('rooms/index', { rooms });
});

router.get('/:path', async (req, res, next) => {
  const roomPath = req.params.path;
  let room;
  try {
    room = await db.rooms.getRoom(roomPath);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }

  res.render('rooms/room', { room, IMAGE_EXTENSIONS });
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
    !IMAGE_EXTENSIONS.some((ext) =>
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
