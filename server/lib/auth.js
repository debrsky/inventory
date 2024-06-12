const createError = require('http-errors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const {getUserById, getUserByNamePassword} = require('./users.js');

function setAuthorize(app) {
	app.use(passport.initialize());
	app.use(passport.session());

	app.get('/login', (req, res) => {
		const message = req.session.message;
		delete req.session.message;
		res.render('login', {message});
	});

	app.get('/logout', (req, res, next) => {
		// https://owasp.org/www-community/attacks/Session_fixation
		// https://medium.com/passportjs/fixing-session-fixation-b2b68619c51d
		// https://github.com/jaredhanson/passport/issues/192
		req.logout((err) => {
			if (err) return next(err);
			res.redirect('/login');
		});
	});

	const authenticateMiddlware = function (req, res, next) {
		const loginCb = function (err) {
			if (err) return next(err);

			req.session.save((err) => {
				if (err) return next(err);
				if (req.xhr) return res.status(200).end();

				res.redirect('/');
			});
		};

		function authCb(err, user, _info) {
			if (err) return next(err);

			if (!user) {
				if (req.xhr) return next(createError(403));

				req.session.message = 'Неверное имя пользователя или пароль.';
				return res.redirect(req.originalUrl);
			}

			req.login(user, loginCb);
		}

		const auth = passport.authenticate('local', authCb);
		auth(req, res, next);
	};
	app.post('/login', authenticateMiddlware);

	passport.use(
		new LocalStrategy((username, password, done) => {
			(async () => {
				const user = await getUserByNamePassword(username, password);
				if (user) return done(null, user);
				done(null, false);
			})().catch((err) => done(err));
		})
	);

	passport.serializeUser((user, done) => {
		done(null, user.id);
	});

	passport.deserializeUser((id, done) => {
		(async () => {
			const user = await getUserById(id);
			if (user) return done(null, user);
			return done(null, false);
		})().catch((err) => done(err));
	});
}

function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) return next();
	if (req.xhr) return next(createError(403));

	res.redirect('/login');
}

module.exports = {setAuthorize, isLoggedIn};
