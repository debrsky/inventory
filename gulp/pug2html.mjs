import gulp from 'gulp';
import plumber from 'gulp-plumber';
import pug from 'gulp-pug';

// 59 vulnerabilities (2 low, 12 moderate, 40 high, 5 critical)
// import pugLinter from 'gulp-pug-linter';

export default function pug2html() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	const pugOptions = {
		pretty: process.env.NODE_ENV !== 'production',
		basedir: process.rootDir
	};

	return gulp
		.src(`${SRC_DIR}/pages/**/*.pug`)
		.pipe(plumber())
		//		.pipe(pugLinter({reporter: 'default'}))
		.pipe(pug(pugOptions))
		.pipe(gulp.dest(`${DEST_DIR}`));
}
