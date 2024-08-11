const send = require('send');
send.mime.define({
  'image/avif': ['avif']
});

const busboy = require('busboy');

const express = require('express');
const router = express.Router();

const db = require('../../lib/db/index.js');

router.use((req, res, next) => {
  res.locals.baseUrl = req.baseUrl;
  next();
})

router.get('/', async function (req, res, next) {
  try {
    const items = (await db.items.getItems()).sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });
    const places = await db.items.getPlaces();
    const tags = await db.items.getTags();

    res.render('inventory/index', {
      title: 'Инвентаризация',
      items,
      places,
      tags
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async function (req, res, next) {
  try {
    await db.items.addIds(5);
    res.redirect(req.originalUrl);
  } catch (err) {
    return next(err);
  }
});

router.get(['/items/:id', '/items/:id/edit'], async function (req, res, next) {
  const id = req.params.id;
  if (!db.items.isIdValid(id)) return next();

  const mode = req.url.endsWith('/edit') ? 'edit' : 'view';

  try {
    const item = await db.items.getItem(id);
    res.render('inventory/item', {
      title: `${item.id} Инвентаризация`,
      mode,
      item
    });
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }
});

router.post('/items/:id', async function (req, res, next) {
  const id = req.params.id;
  if (!db.items.isIdValid(id)) return next();

  const data = {};
  const filesToRemove = [];

  const bb = busboy({ headers: req.headers });
  bb.on('file', async (name, file, info) => {
    const { filename, encoding, mimeType } = info;

    if (name === 'file' && filename) {
      const ws = await db.items.createWriteFileStream(id, filename);
      file.pipe(ws);
    } else {
      file.on('data', () => { }); // no file
    }
  });
  bb.on('field', (name, val, info) => {
    // console.log(`Field [${name}]: value: %j info:${JSON.stringify(info)}`, val);
    if (name === 'remove-file[]') {
      filesToRemove.push(val);
      return;
    }

    if (name.endsWith('[]')) {
      if (!data[name]) data[name] = [];
      data[name].push(val);
      return;
    }

    data[name] = val;
  });
  bb.on('close', async () => {
    try {
      if (filesToRemove.length > 0) {
        await Promise.all(
          filesToRemove.map((file) => db.items.removeFile(id, file))
        );
      }

      await db.items.writeInfo(id, data);

      const searchStr = (req.originalUrl.match(/\?.*$/) ?? [])[0];
      const searchParams = new URLSearchParams(searchStr);
      searchParams.delete('mode');
      const newSearchStr =
        searchParams.size > 0 ? `?${searchParams.toString()}` : '';
      const url = req.originalUrl.replace(searchStr, newSearchStr);

      // TODO checking success of processing of all uploaded files
      res.redirect(url);
    } catch (err) {
      return next(err);
    }
  });
  bb.on('error', (err) => {
    next(err);
  });

  req.pipe(bb);
});

router.get('/items/:id/:file', async function (req, res, next) {
  try {
    const id = req.params.id;
    if (!db.items.isIdValid(id)) return next();

    const file = req.params.file;

    const pathToFile = await db.items.getPathToFile(id, file);

    const stream = send(req, pathToFile)
      .on('error', (err) => {
        if (err.code === 'ENOENT') return next();
        return next(err);
      })
      .on('headers', (res, path, stat) => {
        if (/Report.htm$/.test(path)) {
          res.setHeader('Content-Type', 'text/html; charset=Windows-1251');
        }
      });

    stream.pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }
});

router.get('/items/:id/preview/:file', async function (req, res, next) {
  const id = req.params.id;
  if (!db.items.isIdValid(id)) return next();

  const file = req.params.file;

  try {
    const pathToFile = await db.items.getPathToPreviewFile(id, file);

    const stream = send(req, pathToFile)
      .on('error', (err) => {
        if (err.code === 'ENOENT') return next();
        return next(err);
      })
      .on('headers', (res, path, stat) => {
        if (/Report.htm$/.test(path)) {
          res.setHeader('Content-Type', 'text/html; charset=Windows-1251');
        }
      });

    stream.pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    return next(err);
  }
});

router.get('/aida64', async (req, res, next) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  await db.items.aida64ParseAll(res).catch(err => res.write(`Error: ${err.code}`));
  res.end();
})

module.exports = router;
