const config = require('../config.js');

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const responseTime = require('response-time');

const sessions = require('./lib/sessions');
const { setAuthorize, isLoggedIn } = require('./lib/auth.js');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const inventoryRouter = require('./routes/inventory');

const app = express();
app.use(responseTime());

if (process.env.NODE_ENV === 'development') {
	// https://bytearcher.com/articles/refresh-changes-browser-express-livereload-nodemon/
	const connectLivereload = require('connect-livereload');
	const ignore = [/\.js(\?.*)?$/, /\.css(\?.*)?$/, /\.svg(\?.*)?$/, /\.ico(\?.*)?$/,
		/\.woff(\?.*)?$/, /\.png(\?.*)?$/, /\.jpg(\?.*)?$/, /\.jpeg(\?.*)?$/, /\.gif(\?.*)?$/, /\.pdf(\?.*)?$/,
		/\.json(\?.*)?$/, /\.webp(\?.*)?$/, /\.avif(\?.*)?$/, /\.mp4(\?.*)?$/
	];
	app.use(connectLivereload({ ignore }));
}

app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(sessions());
setAuthorize(app);

app.use(express.static(config.public));

app.use(isLoggedIn);

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/inventory', inventoryRouter);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);

	if (req.xhr) return res.send(err.message);

	res.render('error');
});

module.exports = app;
