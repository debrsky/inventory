import gulp from 'gulp';

export default function copy() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	return gulp
		.src(`${SRC_DIR}/**/*.{ttf,json,txt,css}`)
		.pipe(gulp.dest(`${DEST_DIR}`));
}
