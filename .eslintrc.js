const config = require('./config.js');

module.exports = {
	env: {
		commonjs: true,
		es2021: true,
		browser: true
	},
	plugins: ['sonarjs', 'prettier', 'json'],
	extends: [
		'semistandard',
		'plugin:sonarjs/recommended',
		'plugin:json/recommended',
		'plugin:prettier/recommended'
	],
	parserOptions: {
		ecmaVersion: 2021
	},
	ignorePatterns: [config.public],
	rules: {},
	overrides: [{files: ['*.js', '*.mjs']}]
};
