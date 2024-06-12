import 'dotenv/config';

import {fileURLToPath} from 'url';
import {dirname} from 'path';

import gulp from 'gulp';

import config from './config.js';

import clean from './gulp/clean.mjs';
import html from './gulp/html.mjs';
import css from './gulp/css.mjs';
import less from './gulp/less.mjs';
import pug2html from './gulp/pug2html.mjs';
import script from './gulp/script.mjs';
import copy from './gulp/copy.mjs';
import watch from './gulp/watch.mjs';

console.log(`NODE_ENV=${process.env.NODE_ENV}`);

export default function defaultTask(cb) {
	console.log('default ok');
	cb();
}

process.rootDir = dirname(fileURLToPath(import.meta.url));
process.srcDir = config.frontSrc;
process.destDir = config.public;

const build = gulp.series(
	clean,
	gulp.parallel(html, less, css, pug2html, script, copy)
);

export {clean, html, less, css, pug2html, script, copy, watch, build};
