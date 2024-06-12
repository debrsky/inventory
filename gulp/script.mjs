import gulp from 'gulp';
import gulpEsbuild from 'gulp-esbuild';
import {commonjs} from '@hyrious/esbuild-plugin-commonjs';
import pug from 'pug';
import {compile as svelteCompile} from 'svelte/compiler';
import fs from 'fs';
import path from 'path';

const pugPlugin = () => ({
	name: 'pug',
	setup(build) {
		build.onLoad({filter: /\.pug$/}, async (args) => {
			const source = await fs.promises.readFile(args.path, 'utf8');

			const pugFnStr = pug.compileClient(source, {});
			const contents = pugFnStr + '\nexport default template;';
			return {contents};
		});
	}
});

// https://esbuild.github.io/plugins/#svelte-plugin
const sveltePlugin = () => ({
	name: 'svelte',
	setup(build) {
		build.onLoad({filter: /\.svelte$/}, async (args) => {
			// This converts a message in Svelte's format to esbuild's format
			const convertMessage = ({message, start, end}) => {
				let location;
				if (start && end) {
					const lineText = source.split(/\r\n|\r|\n/g)[start.line - 1];
					const lineEnd =
						start.line === end.line ? end.column : lineText.length;
					location = {
						file: filename,
						line: start.line,
						column: start.column,
						length: lineEnd - start.column,
						lineText
					};
				}
				return {text: message, location};
			};

			// Load the file from the file system
			const source = await fs.promises.readFile(args.path, 'utf8');
			const filename = path.relative(process.cwd(), args.path);

			// Convert Svelte syntax to JavaScript
			try {
				const {js, warnings} = svelteCompile(source, {filename});
				const contents = js.code + `//# sourceMappingURL=` + js.map.toUrl();
				return {contents, warnings: warnings.map(convertMessage)};
			} catch (e) {
				return {errors: [convertMessage(e)]};
			}
		});
	}
});

export default function script() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	return gulp
		.src(`${SRC_DIR}/js/*.js`)
		.pipe(
			gulpEsbuild({
				metafile: false, // https://www.bundle-buddy.com/esbuild
				bundle: true,
				minify: process.env.NODE_ENV === 'production',
				define: {global: 'window'},
				sourcemap: 'linked',
				plugins: [commonjs(), pugPlugin(), sveltePlugin()]
			})
		)
		.pipe(gulp.dest(`${DEST_DIR}/js`));
}
