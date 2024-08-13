const config = require('../../../config.js');

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
  let room;
  try {
    room = await db.rooms.getRoom(roomPath);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }

  res.render('rooms/room', { room, mode });
});

router.post('/:path', async (req, res, next) => {
  console.log({ body: req.body });

  const roomPath = req.params.path;
  let room;
  try {
    room = await db.rooms.getRoom(roomPath);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }

  const info = room.info ?? {};
  Object.assign(info, req.body);
  console.log({ info });

  try {
    await db.rooms.writeInfo(roomPath, info);
  } catch (err) {
    return next(err);
  }

  res.redirect(req.originalUrl);
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
