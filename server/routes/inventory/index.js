const send = require('send');
send.mime.define({
	'image/avif': ['avif']
});

const busboy = require('busboy');

const express = require('express');
const router = express.Router();

const DB = require('../../lib/db/index.js');

router.get('/', async function (req, res, next) {
	try {
		const items = (await DB.getItems()).sort((a, b) => {
			if (a.id < b.id) return 1;
			if (a.id > b.id) return -1;
			return 0;
		});
		const places = await DB.getPlaces();
		const tags = await DB.getTags();

		res.render('inventory/index', { title: 'Инвентаризация', baseUrl: req.baseUrl, items, places, tags });

	} catch (err) {
		return next(err);
	}
});

router.post('/', async function (req, res, next) {
	try {
		await DB.addIds(5);
		res.redirect(req.originalUrl);
	} catch (err) {
		return next(err);
	}
});

router.get(['/items/:id', '/items/:id/edit'], async function (req, res, next) {
	const id = req.params.id;
	if (!DB.ID_SCHEMA.test(id)) return next();

	const mode = req.url.endsWith('/edit') ? 'edit' : 'view';

	try {
		const item = await DB.getItem(id);
		res.render('inventory/item', { title: `${item.id} Инвентаризация`, baseUrl: req.baseUrl, mode, item });
	} catch (err) {
		if (err.code === 'ENOENT') return next();
		return next(err);
	}
});

router.post('/items/:id', async function (req, res, next) {
	const id = req.params.id;
	if (!DB.ID_SCHEMA.test(id)) return next();

	const data = {};
	const filesToRemove = [];


	const bb = busboy({ headers: req.headers });
	bb.on('file', async (name, file, info) => {
		const { filename, encoding, mimeType } = info;

		if (name === "file" && filename) {
			const ws = await DB.createWriteFileStream(id, filename);
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
				await Promise.all(filesToRemove.map(file => DB.removeFile(id, file)));
			}

			await DB.writeInfo(id, data);

			const searchStr = (req.originalUrl.match(/\?.*$/) ?? [])[0];
			const searchParams = new URLSearchParams(searchStr);
			searchParams.delete('mode');
			const newSearchStr = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
			const url = req.originalUrl.replace(searchStr, newSearchStr);

			// TODO checking success of processing of all uploaded files
			res.redirect(url);

		} catch (err) {
			return next(err);
		}
	});
	bb.on('error', (err) => {
		next(err);
	})

	req.pipe(bb);
});

router.get('/items/:id/:file', async function (req, res, next) {
	try {
		const id = req.params.id;
		if (!DB.ID_SCHEMA.test(id)) return next();

		const file = req.params.file;

		const pathToFile = await DB.getPathToFile(id, file);

		const stream = send(req, pathToFile)
			.on('error', (err) => {
				if (err.code === 'ENOENT') return next();
				return next(err);
			}).on('headers', (res, path, stat) => {
				if (/Report.htm$/.test(path)) {
					res.setHeader('Content-Type', 'text/html; charset=Windows-1251')
				};
			});

		stream.pipe(res);
	} catch (err) {
		if (err.code === 'ENOENT') return next();
		return next(err);
	}
});

router.get('/items/:id/preview/:file', async function (req, res, next) {
	const id = req.params.id;
	if (!DB.ID_SCHEMA.test(id)) return next();

	const file = req.params.file;

	try {

		const pathToFile = await DB.getPathToPreviewFile(id, file);

		const stream = send(req, pathToFile)
			.on('error', (err) => {
				if (err.code === 'ENOENT') return next();
				return next(err);
			}).on('headers', (res, path, stat) => {
				if (/Report.htm$/.test(path)) {
					res.setHeader('Content-Type', 'text/html; charset=Windows-1251')
				};
			});

		stream.pipe(res);
	} catch (err) {
		if (err.code === 'ENOENT') return next();
		return next(err);
	}
});

router.get('/items.zip', async function (req, res, next) {
	res.setHeader('Content-Type', 'application/zip');
	res.setHeader('Content-Disposition', 'attachment; filename=items.zip');
	try {
		await DB.zipArchive(res);
	} catch (err) {
		return next(err);
	}
})

module.exports = router;
