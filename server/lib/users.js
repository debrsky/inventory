const config = require('../../config.js');
const fs = require('fs').promises;
const writeFileAtomic = require('write-file-atomic');
const path = require('path');
const {pbkdf2, randomBytes, timingSafeEqual} = require('crypto');

const ITERATIONS = 100000;
const KEYLEN = 32;
const DIGEST = 'sha512';
const ENCODING = 'base64url';

const usersFile = path.join(config.rootDir, config.storage, 'users.json');

async function getUserById(id) {
	const users = await readUsers();
	return users.find((user) => user.id === id);
}

async function getUserByNamePassword(username, password) {
	const usernameNormalized = username.normalize();

	const users = await readUsers();
	const user = users.find(
		(user) => user.name.normalize() === usernameNormalized
	);
	if (!user) return null;

	const derivedKey = await pbkdf2Async(
		password.normalize(),
		user.salt,
		ITERATIONS,
		KEYLEN,
		DIGEST
	);
	if (
		!timingSafeEqual(
			Buffer.from(user.derivedKey, ENCODING),
			Buffer.from(derivedKey, ENCODING)
		)
	)
		return null;

	return user;
}

function pbkdf2Async(password, salt, iterations, keylen, digest) {
	const executor = (resolve, reject) => {
		pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
			if (err) return reject(err);
			resolve(derivedKey.toString(ENCODING));
		});
	};

	return new Promise(executor);
}

async function readUsers() {
	const users = JSON.parse(await fs.readFile(usersFile, 'utf-8'));
	if (!users.some((user) => Boolean(user.password))) return users;

	for (const user of users) {
		if (!user.password) continue;

		const secret = user.password.normalize();
		const salt = randomBytes(KEYLEN).toString(ENCODING);

		user.derivedKey = await pbkdf2Async(
			secret,
			salt,
			ITERATIONS,
			KEYLEN,
			DIGEST
		);
		user.salt = salt;
		delete user.password;
	}

	await writeFileAtomic(usersFile, JSON.stringify(users, null, 4));

	return users;
}

module.exports = {getUserById, getUserByNamePassword};
