const archiver = require('archiver');

const items = require('./items.js');
const rooms = require('./rooms.js');

/**
 * Creates a zip archive of the contents of the specified directory and pipes it to the provided output stream.
 *
 * @async
 * @function zipArchive
 * @param {stream.Writable} output - The output stream to which the zip archive will be piped.
 * @returns {Promise<void>} - A promise that resolves when the archive has been finalized.
 */
async function zipArchive(output) {
  const archive = archiver('zip', {
    zlib: { level: 1 } // Compression level
  });
  archive.pipe(output);
  archive.directory(items.ITEMS_DIR, 'ITEMS');
  archive.directory(rooms.ROOMS_DIR, 'ROOMS');
  await archive.finalize();
}

module.exports = {
  items,
  rooms,
  zipArchive
};
