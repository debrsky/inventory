const config = require('../../../config.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const send = require('send');
send.mime.define({
	'image/avif': ['avif']
});

const DB_DIR = config.dbDir;
const CACHE_DIR = path.join(DB_DIR, 'CACHE');
const ITEMS_DIR = path.join(DB_DIR, 'ITEMS');
const INFO_FILE = 'info.json';
const REPORT_FILE = 'Report.xml';

const ID_SCHEMA = /^\d\d\d\d$/;

const iconv = require('iconv-lite');
const busboy = require('busboy');

const express = require('express');
const router = express.Router();

const resize = require('../../lib/utils/ffmpeg.js');

router.get('/', async function (req, res, next) {
	try {
		const ids = (await fs.promises.readdir(ITEMS_DIR, { withFileTypes: true }))
			.filter(file => file.isDirectory() && ID_SCHEMA.test(file.name))
			.map(el => el.name);

		const items = (await Promise.allSettled(
			ids.map(id => fs.promises.readFile(path.join(ITEMS_DIR, id, INFO_FILE), 'utf8')))
		).map((res, idx) => {
			if (res.status === "rejected" && res.reason.code !== "ENOENT") throw Error(res.reason.code);
			if (res.status === "rejected") return { id: ids[idx] };
			// res.status === "fulfilled"
			return { id: ids[idx], ...JSON.parse(res.value) };
		});

		res.render('inventory/index', { title: 'Инвентаризация', baseUrl: req.baseUrl, items });

	} catch (err) {
		return next(err);
	}
});

router.post('/', async function (req, res, next) {
	try {
		const ids = (await fs.promises.readdir(ITEMS_DIR, { withFileTypes: true }))
			.filter(file => file.isDirectory() && ID_SCHEMA.test(file.name))
			.map(el => Number(el.name))
			.sort((a, b) => a - b);
		const newId = ((ids.at(-1)) + 1).toString();
		await fs.promises.mkdir(path.join(ITEMS_DIR, newId));
		res.redirect(req.originalUrl);
	} catch (err) {
		return next(err);
	}
});

router.get(['/items/:id', '/items/:id/edit'], async function (req, res, next) {
	const id = req.params.id;
	if (!ID_SCHEMA.test(id)) return next();

	const mode = req.url.endsWith('/edit') ? 'edit' : 'view';

	const item = {
		id, type: "", brand: "", model: "", place: "", comment: ""
	};

	try {
		const files = (await fs.promises.readdir(path.join(ITEMS_DIR, id), { withFileTypes: true }))
			.filter(file => !file.isDirectory())
			.map(el => el.name);

		const infoPath = path.join(ITEMS_DIR, id, INFO_FILE);
		try {
			const info = JSON.parse(await fs.promises.readFile(infoPath, 'utf8'));
			Object.assign(item, info);
		} catch (err) {
			if (err.code !== 'ENOENT') throw Error(err);
		}

		res.render('inventory/item', { title: `${item.id} Инвентаризация`, baseUrl: req.baseUrl, mode, item, files, content: files.join("\n") });

	} catch (err) {
		if (err.code === 'ENOENT') return next();
		return next(err);
	}
});

router.post('/items/:id', async function (req, res, next) {
	const id = req.params.id;
	if (!ID_SCHEMA.test(id)) return next();

	const data = {};
	const filesToRemove = [];


	const bb = busboy({ headers: req.headers });
	bb.on('file', (name, file, info) => {
		const { filename, encoding, mimeType } = info;

		if (name === "file" && filename) {
			const tempdir = os.tmpdir();
			const tempfname = crypto.randomUUID();
			const pathToFile = path.join(ITEMS_DIR, id, filename);
			const pathToTempFile = path.join(tempdir, tempfname);
			const ws = fs.createWriteStream(pathToTempFile).on('finish', () => {
				fs.rename(pathToTempFile, pathToFile, (err) => { if (err) console.error(err) });
			});
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
		if (filesToRemove.length > 0) {
			try {
				for (filename of filesToRemove) {
					const pathToFile = path.join(ITEMS_DIR, id, filename);
					await fs.promises.unlink(pathToFile);
				}
			} catch (err) {
				return next(err);
			}
		}

		const infoPath = path.join(ITEMS_DIR, id, INFO_FILE);

		try {
			await fs.promises.writeFile(infoPath, JSON.stringify(data, null, 4));
		} catch (err) {
			return next(err);
		}

		const searchStr = (req.originalUrl.match(/\?.*$/) ?? [])[0];
		const searchParams = new URLSearchParams(searchStr);
		searchParams.delete('mode');
		const newSearchStr = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
		const url = req.originalUrl.replace(searchStr, newSearchStr);

		res.redirect(url);
	});
	bb.on('error', (err) => {
		next(err);
	})

	req.pipe(bb);
});

router.get('/items/:id/:file', async function (req, res, next) {
	const id = req.params.id;
	if (!ID_SCHEMA.test(id)) return next();

	const file = req.params.file;

	const pathToFile = path.resolve(path.join(ITEMS_DIR, id, file)).replace(/\\/g, '/');

	let fileStat;
	try {
		fileStat = await fs.promises.stat(pathToFile);
	}
	catch (err) {
		if (err === 'ENOENT') return next();
		return next(err);
	}

	const ext = path.extname(file).slice(1).toLowerCase();

	// const stream = fs.createReadStream(pathToFile)
	// 	.on('error', (err) => {
	// 		if (err.code === 'ENOENT') return next();
	// 		return next(err);
	// 	});
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

	// res.on('close', () => { stream.destroy(); converterStream?.destroy() });
});

router.get('/items/:id/preview/:file', async function (req, res, next) {
	const id = req.params.id;
	if (!ID_SCHEMA.test(id)) return next();

	const file = req.params.file;

	const dir = path.resolve(path.join(CACHE_DIR, id));
	const pathToFile = path.resolve(path.join(dir, file));

	try {
		await fs.promises.stat(pathToFile);
	}
	catch (err) {
		if (err.code !== 'ENOENT') return next(err);

		const pathToOriginalFile = path.resolve(path.join(ITEMS_DIR, id, file));
		try {
			await fs.promises.stat(pathToOriginalFile);
		} catch (err) {
			if (err.code !== 'ENOENT') return next(err);
			return next();
		}

		fs.promises.mkdir(dir, { recursive: true })
		try {
			await resize(pathToOriginalFile, pathToFile);
		} catch (err) {
			return next(err);
		}

	}

	const ext = path.extname(file).slice(1).toLowerCase();

	const stream = fs.createReadStream(pathToFile)
		.on('error', (err) => {
			if (err.code === 'ENOENT') return next();
			return next(err);
		});

	res.type(ext);
	if (ext === 'avif') res.set({ 'Content-Type': 'image/avif' });
	stream.pipe(res);

	res.on('close', () => { stream.destroy() });
});



module.exports = router;
