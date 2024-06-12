import gulp from 'gulp';

import copy from './copy.mjs';
import html from './html.mjs';
import css from './css.mjs';
import less from './less.mjs';
import pug2html from './pug2html.mjs';
import script from './script.mjs';

export default function serve() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir; // eslint-disable-line no-unused-vars

	gulp.watch(`${SRC_DIR}/**/*.{ttf,json,txt}`, copy);
	gulp.watch(`${SRC_DIR}/**/*.html`, html);
	gulp.watch(`${SRC_DIR}/**/*.css`, css);
	gulp.watch(`${SRC_DIR}/**/*.less`, less);
	gulp.watch(`${SRC_DIR}/pages/*.pug`, pug2html);
	gulp.watch(`${SRC_DIR}/js/*.{js,svelte}`, script);
}
