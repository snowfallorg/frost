const arg = require("arg");
const rootArgs = require("../../util/args");

module.exports = () => ({
	...arg(
		{
			...rootArgs,

			"--output": String,
			"-o": "--output",
		},
		{
			permissive: false,
		}
	),
});
