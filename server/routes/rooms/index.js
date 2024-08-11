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


router.get(/^(?!.*\.[a-zA-Z0-9]+$).*/, async (req, res, next) => {
  const roomPath = decodeURIComponent(req.url).slice(1);
  let room;
  try {
    room = await db.rooms.getRoom(roomPath);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }

  res.render('rooms/room', { room, IMAGE_EXTENSIONS });

});

router.get(/\.[a-zA-Z0-9]+$/, async (req, res, next) => {
  const fileUrl = decodeURIComponent(req.url);

  try {
    const pathToFile = await db.rooms.getPathToFile(fileUrl);

    const stream = send(req, pathToFile).on('error', (err) => {
      if (err.code === 'ENOENT') return next();
      return next(err);
    });

    stream.pipe(res);
  } catch (err) {
    console.log('file error');
    if (err.code === 'ENOENT') return next();
    return next(err);
  }
});

router.get('/preview/*', async (req, res, next) => {
  const fileUrl = req.params[0];

  const fileUrlLowerCase = fileUrl.toLowerCase();
  if (
    !IMAGE_EXTENSIONS.some((ext) =>
      fileUrlLowerCase.endsWith(`.${ext}`)
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
