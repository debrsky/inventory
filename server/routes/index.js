const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
	const counter = (req.session.counter ?? 0) + 1;
	const user = req.user;

	req.session.counter = counter;
	req.session.save((err) => {
		if (err) return next(err);
		res.render('index', {title: 'Express', counter, user});
	});
});

module.exports = router;
