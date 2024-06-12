import gulp from 'gulp';
import gulpLess from 'gulp-less';
import plumber from 'gulp-plumber';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import rename from 'gulp-rename';

export default function less() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	const postcssPlugins = [autoprefixer()];
	if (process.env.NODE_ENV === 'production')
		postcssPlugins.push(cssnano({ preset: 'default' }));

	return gulp
		.src(`${SRC_DIR}/less/style.less`, { sourcemaps: true })
		.pipe(plumber())
		.pipe(gulpLess())
		.pipe(postcss(postcssPlugins))
		.pipe(rename('style.css'))
		.pipe(gulp.dest(`${DEST_DIR}/css`, { sourcemaps: '.' }));
}
