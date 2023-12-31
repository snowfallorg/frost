const fs = require("fs/promises");
const path = require("path");
const log = require("../../util/log");
const {
	getFlakeOutputs,
	getFlakeLibMembers,
	getSnowfallConfig,
	getFlakePackages,
	stripStorePath,
	isStorePath,
	getFlakeOutput,
	getFlakeModuleOptions,
	getFlakeApps,
	getFlakeModules,
} = require("../../util/nix");
const getArgs = require("./args");
const help = require("./help");
const { parseFile, traverse } = require("../../util/parser");
const { NodeKind, isAttrBinding } = require("@snowfallorg/sleet");
const { mkdirp } = require("mkdirp");
const { readDirRecursive, resolvePath, clearCollection, write } = require("../../util/fs");
const { getLib, getPackages, getOptions, getApps } = require("../../util/flake");
const {
	generatePackages,
	generateOptions,
	generateApps,
	generateMeta,
	generateLib,
	generateShells,
} = require("../../util/gen");

module.exports = async () => {
	log.info("Generate");
	const args = getArgs();

	if (args["--help"]) {
		help();
		process.exit(0);
	}

	if (args._.length > 2) {
		help();
		log.fatal("Too many arguments.");
		process.exit(1);
	}

	let flake = process.cwd();
	const output = resolvePath(args["--output"] ?? "./frost-data");

	if (args._.length === 2) {
		flake = args._[1];
	}

	if (flake.startsWith(".")) {
		flake = path.resolve(process.cwd(), flake);
	}

	log.debug({ flake });

	const outputs = await getFlakeOutputs(flake);

	log.debug({ outputs });

	const config = await getSnowfallConfig(flake);

	log.debug({ config });

	const nixConfig = await getFlakeOutput(flake, "nixConfig");

	log.debug({ nixConfig });

	const lib = await getLib(flake, config);
	const packages = await getPackages(flake);
	const options = await getOptions(flake);
	const apps = await getApps(flake);
	const shells = new Map();

	await mkdirp(output);

	await generatePackages(output, packages);
	await generateOptions(output, options);
	await generateApps(output, apps);
	await generateLib(output, lib);
	await generateShells(output, shells);
	await generateMeta(output, flake, {
		snowfall: config,
		nix: nixConfig,
		uri: args._[1],
	});
};
