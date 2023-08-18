const fs = require("fs/promises");
const path = require("path");
const log = require("./log");
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
} = require("./nix");
const { parseFile, traverse } = require("./parser");
const { NodeKind, isAttrBinding } = require("@snowfallorg/sleet");
const { mkdirp } = require("mkdirp");
const { readDirRecursive, resolvePath, clearCollection, write } = require("./fs");

const getLib = async (flake, config, asts = new Map()) => {
	const isFlakeUriPath = flake.startsWith(".") || flake.startsWith("/");

	const allLibMembers = await getFlakeLibMembers(flake);
	const libMembersWithLocation = allLibMembers.filter((member) => member.location !== null);
	const libMembersWithoutLocation = allLibMembers.filter((member) => member.location === null);

	const lib = new Map();

	for (const member of libMembersWithLocation) {
		let ast;
		if (asts.has(member.location.file)) {
			ast = asts.get(member.location.file);
		} else {
			ast = await parseFile(member.location.file);
			asts.set(member.location.file, ast);
		}

		traverse(ast, {
			[NodeKind.Attr](node) {
				if (!isAttrBinding(node)) {
					return;
				}

				const identifier = node.name;

				if (!identifier.kind === NodeKind.Identifier) {
					return;
				}

				const isLiteral = identifier.value.every((item) => typeof item === "string");

				if (!isLiteral) {
					return;
				}

				const name = identifier.value[identifier.value.length - 1];

				if (
					member.name === name &&
					member.location.line >= identifier.loc.start.line &&
					member.location.line <= identifier.loc.end.line &&
					member.location.column >= identifier.loc.start.col &&
					member.location.column <= identifier.loc.end.col
				) {
					const comment = node.comments.map((comment) => comment.value).join("\n");

					lib.set(member, {
						member,
						comment,
					});
				}
			},
		});
	}

	if (libMembersWithoutLocation.length > 0) {
		if (config === null) {
			log.warn("Library attributes without location information are not supported outside of Snowfall Lib.");
		} else {
			let root = config.root;

			if (isFlakeUriPath && isStorePath(root)) {
				root = path.join(flake, stripStorePath(root));
			}

			const libFiles = await readDirRecursive(path.resolve(root, config["lib-dir"] ?? "lib"));

			log.debug({ libFiles });

			for (const file of libFiles) {
				let ast;
				if (asts.has(file)) {
					ast = asts.get(file);
				} else {
					ast = await parseFile(file);
					asts.set(file, ast);
				}

				traverse(ast, {
					[NodeKind.Attr](node) {
						if (!isAttrBinding(node)) {
							return;
						}

						const identifier = node.name;

						if (!identifier.kind === NodeKind.Identifier) {
							return;
						}

						const isLiteral = identifier.value.every((item) => typeof item === "string");

						if (!isLiteral) {
							return;
						}

						const name = identifier.value[identifier.value.length - 1];

						for (const member of libMembersWithoutLocation) {
							if (member.name === name) {
								if (lib.has(member)) {
									log.warn(`Found duplicate definition of ${[...member.path, member.name].join(".")}`);
								}

								const comment = node.comments.map((comment) => comment.value).join("\n");

								lib.set(member, {
									member: {
										...member,
										location: {
											file,
											line: identifier.loc.start.line,
											column: identifier.loc.start.col,
										},
									},
									comment,
								});
							}
						}
					},
				});
			}
		}
	}

	return lib;
};

const getPackages = async (flake) => {
	const packages = new Map();

	for (const package of await getFlakePackages(flake)) {
		if (!packages.has(package.name)) {
			packages.set(package.name, {
				systems: [],
				available: package.meta?.available ?? true,
				broken: package.meta?.broken ?? false,
				insecure: package.meta?.insecure ?? false,
				unfree: package.meta?.unfree ?? false,
				unsupported: package.meta?.unsupported ?? false,
				outputs: package.meta?.outputsToInstall ?? [],
				description: package.meta?.description ?? null,
				longDescription: package.meta?.longDescription ?? null,
				license: package.meta?.license ?? null,
				homepage: package.meta?.homepage ?? null,
				maintainers: package.meta?.maintainers ?? [],
				snowfall: package.meta.snowfall ?? {},
				position:
					package.meta?.position && !package.meta.position.includes("/pkgs/build-support/trivial-builders/")
						? package.meta?.position
						: null,
			});
		}

		const pkg = packages.get(package.name);
		pkg.systems.push(package.system);
	}

	return packages;
};

const getOptions = async (flake) => {
	const isFlakeUriPath = flake.startsWith(".") || flake.startsWith("/");

	const options = await getFlakeModuleOptions(flake, {
		channelName: isFlakeUriPath ? "<flake>" : flake,
		moduleUrl: isFlakeUriPath ? `${flake}/` : `<link>/`,
	});

	return options;
};

const getApps = async (flake) => {
	const apps = new Map();

	for (const app of await getFlakeApps(flake)) {
		if (!apps.has(app.name)) {
			apps.set(app.name, {
				systems: [],
			});
		}

		const existing = apps.get(app.name);
		existing.systems.push(app.system);
	}

	return apps;
};

module.exports = {
	getLib,
	getPackages,
	getOptions,
	getApps,
};
