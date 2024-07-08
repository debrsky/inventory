const { spawn, spawnSync } = require("child_process");

process.stdout.write("checking ffmpeg... ");
const res = spawnSync("ffmpeg");
if (res.error) {
	process.stdout.write("error.\n");
	console.error(res.error);
	process.exit(1);
}
process.stdout.write("ok.\n");

function resize(src, dst) {
	const args = [
		"-hide_banner",
		"-i",
		src.replace('/\\/g', '/'),
		"-vf",
		"scale=300:-1",
		dst.replace('/\\/g', '/')
	];

	const executor = (resolve, reject) => {
		const ffmpeg = spawn("ffmpeg", args)
			.on("error", (err) => reject(err))
			.on("spawn", () => { })
			.on("close", () => resolve(null));

		// ffmpeg.stdout.on('data', (data) => console.log(`stdout: ${data}`));
		// ffmpeg.stderr.on('data', (data) => console.log(`stderr: ${data}`));

	}

	return new Promise(executor);
}

module.exports = resize;
