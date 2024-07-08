const config = require('../../../config.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const resize = require('../utils/ffmpeg.js');

const DB_DIR = config.dbDir;
const CACHE_DIR = path.join(DB_DIR, 'CACHE');
const ITEMS_DIR = path.join(DB_DIR, 'ITEMS');
const INFO_FILE = 'info.json';

const ID_SCHEMA = /^\d\d\d\d$/;

async function getItems() {
	const ids = (await fs.promises.readdir(ITEMS_DIR, { withFileTypes: true }))
		.filter(file => file.isDirectory() && ID_SCHEMA.test(file.name))
		.map(el => el.name);

	const items = (await Promise.allSettled(
		ids.map(id => fs.promises.readFile(path.join(ITEMS_DIR, id, INFO_FILE), 'utf8')))
	).map((res, idx) => {
		if (res.status === "rejected" && res.reason.code !== "ENOENT") throw Error(res.reason);
		if (res.status === "rejected") return { id: ids[idx] };
		// res.status === "fulfilled"
		return { id: ids[idx], ...JSON.parse(res.value) };
	});

	return items;
}

async function getItem(id) {
	const files = (await fs.promises.readdir(path.join(ITEMS_DIR, id), { withFileTypes: true }))
		.filter(file => !file.isDirectory())
		.map(el => el.name);

	const infoPath = path.join(ITEMS_DIR, id, INFO_FILE);
	let info;
	try {
		info = { type: "", brand: "", model: "", place: "", comment: "" };
		Object.assign(info, JSON.parse(await fs.promises.readFile(infoPath, 'utf8')));
	} catch (err) {
		if (err.code !== 'ENOENT') throw Error(err);
	}

	return { id, info, files };
}

async function getPathToFile({ id, file }) {
	const pathToFile = path.resolve(path.join(ITEMS_DIR, id, file)).replace(/\\/g, '/');
	await fs.promises.access(pathToFile, fs.constants.F_OK);
	return pathToFile;
}

async function getPathToPreviewFile({ id, file }) {
	const dir = path.resolve(path.join(CACHE_DIR, id));
	const pathToFile = path.resolve(path.join(dir, file));

	try {
		await fs.promises.access(pathToFile, fs.constants.F_OK);
	}
	catch (err) {
		if (err.code !== 'ENOENT') throw Error(err);

		const pathToOriginalFile = path.resolve(path.join(ITEMS_DIR, id, file));
		await fs.promises.access(pathToOriginalFile, fs.constants.F_OK);
		await fs.promises.mkdir(dir, { recursive: true });
		await resize(pathToOriginalFile, pathToFile);
	}

	return pathToFile;
}

async function addIds(count) {
	const ids = (await fs.promises.readdir(ITEMS_DIR, { withFileTypes: true }))
		.filter(file => file.isDirectory() && ID_SCHEMA.test(file.name))
		.map(el => Number(el.name))
		.sort((a, b) => a - b);
	const lastId = ids.at(-1);
	const newIds = Array.from({ length: count }, (_, i) => (lastId + 1 + i).toString());

	await Promise.all(newIds.map(newId => fs.promises.mkdir(path.join(ITEMS_DIR, newId))));
}

async function removeFile({ id, file }) {
	const pathToFile = path.join(ITEMS_DIR, id, file);
	await fs.promises.unlink(pathToFile);
	// TODO remove cached preview files
}

async function createWriteFileStream({ id, file }) {
	const tempdir = os.tmpdir();
	const tempfname = crypto.randomUUID();
	const pathToFile = path.join(ITEMS_DIR, id, file);
	const pathToTempFile = path.join(tempdir, tempfname);
	const ws = fs.createWriteStream(pathToTempFile)
		.on('finish', () => {
			fs.rename(pathToTempFile, pathToFile, (err) => { if (err) console.error(err) });
		});

	return ws;
}

async function writeInfo({ id, info }) {
	const infoPath = path.join(ITEMS_DIR, id, INFO_FILE);
	// TODO validate info
	await fs.promises.writeFile(infoPath, JSON.stringify(info, null, 4));
}
module.exports = {
	getItems,
	getItem,
	getPathToFile,
	getPathToPreviewFile,
	addIds,
	removeFile,
	createWriteFileStream,
	writeInfo,
	ID_SCHEMA
}
