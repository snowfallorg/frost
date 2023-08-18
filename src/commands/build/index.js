const { promisify } = require("util");
const childProcess = require("child_process");

const exec = promisify(childProcess.exec);
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
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
	eval,
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
const { rimraf } = require("rimraf");

module.exports = async () => {
	log.info("Build");
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
	const output = resolvePath(args["--output"] ?? "./frost-docs");

	const base = resolvePath(args["--base"] ?? "/");

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

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "frost-"));

	const lib = await getLib(flake, config);
	const packages = await getPackages(flake);
	const options = await getOptions(flake);
	const apps = await getApps(flake);
	const shells = new Map();

	await generatePackages(tmpDir, packages);
	await generateOptions(tmpDir, options);
	await generateApps(tmpDir, apps);
	await generateLib(tmpDir, lib);
	await generateShells(tmpDir, shells);
	await generateMeta(tmpDir, flake, {
		snowfall: config,
		nix: nixConfig,
		uri: args._[1],
	});

	const frostFlake = args["--ui"] ?? "github:snowfallorg/frost-ui";

	const expression = `
let
	frost-ui = prelude.get-flake "${frostFlake}";
	package = frost-ui.packages.\${builtins.currentSystem}.frost-ui.override {
		frost-base = "${base}";
		frost-data = ${tmpDir};
	};
in
	package.drvPath
	`;

	const drvPathResult = await eval(expression, { json: true });

	const derivation = JSON.parse(drvPathResult.stdout);

	await mkdirp(path.dirname(output));

	await exec(`nix build '${derivation}^*' --out-link ${output}`);

	await rimraf(tmpDir);
};
