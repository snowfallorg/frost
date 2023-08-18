const arg = require("arg");
const log = require("./util/log");
const commands = require("./commands");
const rootArgs = require("./util/args");
const help = require("./util/help");

const main = async () => {
	log.trace("Init.");
	log.trace("Parsing root arguments.");
	const args = arg(rootArgs, {
		permissive: true,
	});

	if (args["--help"] && args._.length === 0) {
		help();
		process.exit(0);
	}

	if (args._.length === 0) {
		help();
		process.exit(1);
	}

	const command = args._[0];

	if (command in commands) {
		log.trace(`Executing command "${command}".`);
		await commands[command]();
	} else {
		log.fatal(`Unknown command "${command}".`);
		process.exit(1);
	}
};

main().catch((error) => {
	log.fatal(error.message || error);
	for (const line of error.stack.split("\n").slice(1)) {
		log.fatal(`${line}`);
	}

	process.exit(1);
});
