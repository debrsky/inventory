const { spawn } = require("child_process");

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
		const ffmpeg = spawn("ffmpeg.exe", args)
			.on("error", (err) => reject(err))
			.on("spawn", () => { })
			.on("close", () => resolve(null));

		// ffmpeg.stdout.on('data', (data) => console.log(`stdout: ${data}`));
		// ffmpeg.stderr.on('data', (data) => console.log(`stderr: ${data}`));

	}

	return new Promise(executor);
}

module.exports = resize;
