const send = require('send');
send.mime.define({
	'image/avif': ['avif']
});

const express = require('express');
const router = express.Router();

const dbRooms = require('../../lib/db/rooms/index.js');

const ROOMS_URL_PREFIX = '/ROOMS/';

router.get('/', async (req, res) => {
	const rooms = await dbRooms.getRoomsStructure();

	res.render('rooms/index', { baseUrl: req.baseUrl, rooms });
});


router.get('/*', async (req, res, next) => {
	const fileUrl = req.params[0];

	try {
		const pathToFile = await dbRooms.getPathToFile(fileUrl);

		const stream = send(req, pathToFile)
			.on('error', (err) => {
				if (err.code === 'ENOENT') return next();
				return next(err);
			});

		stream.pipe(res);
	} catch (err) {
		if (err.code === 'ENOENT') return next();
		return next(err);
	}
});


router.get('/preview/*', async (req, res, next) => {
	const fileUrl = req.params[0];
	if (!fileUrl.startsWith(ROOMS_URL_PREFIX)) return next();

	const fileUrlLowerCase = fileUrl.toLowerCase();
	if (!['jpg', 'jpeg', 'png', 'avif', 'webp'].some(ext => fileUrlLowerCase.endsWith(`.${ext}`))) {
		return next();
	}

	const pathToFile = fileUrl.slice(ROOMS_URL_PREFIX.length);

	try {
		const pathToPreviewFile = await dbRooms.getPathToPreviewFile(pathToFile);

		const stream = send(req, pathToPreviewFile)
			.on('error', (err) => {
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
