import {rm} from 'fs/promises';

export default function clean() {
	const SRC_DIR = process.srcDir; // eslint-disable-line no-unused-vars
	const DEST_DIR = process.destDir;

	return rm(DEST_DIR, {recursive: true, force: true});
}
