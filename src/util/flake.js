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

const getLib = async (flake, asts = new Map()) => {
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

module.exports = {
	getLib,
};
