module.exports = {
	extends: [
		'stylelint-config-standard', 
		'stylelint-config-rational-order', 
		'stylelint-config-prettier',
		'stylelint-prettier/recommended'
	],
	plugins: ['stylelint-order', 'stylelint-less'],
	overrides: [
		{
			files: ['front-src/less/**/*.less'],
			customSyntax: 'postcss-less',
			rules: {
				'selector-class-pattern': '^([a-z][a-z0-9]*)((__|_|-|--)[a-z0-9]+)*$' // BEM
			},
				}
	]
};

