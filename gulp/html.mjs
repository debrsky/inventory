import gulp from 'gulp';
import htmlmin from 'gulp-html-minifier-terser';

export default function html() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	let stream = gulp.src(`${SRC_DIR}/**/*.html`);
	if (process.env.NODE_ENV === 'production')
		stream = stream.pipe(
			htmlmin({ collapseWhitespace: true })
		);

	return stream.pipe(gulp.dest(`${DEST_DIR}`));
}
