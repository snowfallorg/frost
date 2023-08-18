const path = require("path");
const { clearCollection, write } = require("./fs");
const { getFlakeModules, getFlakeOutput } = require("./nix");

const generatePackages = async (output, packages) => {
	await clearCollection(path.resolve(output, "packages"));

	let pkgIndex = 0;
	for (const [name, pkg] of packages.entries()) {
		await write(path.resolve(output, "packages", `package-${pkgIndex}.json`), {
			name,
			...pkg,
		});

		pkgIndex++;
	}
};

const generateOptions = async (output, options) => {
	await clearCollection(path.resolve(output, "options"));

	let optIndex = 0;
	for (const [name, opt] of options.entries()) {
		await write(path.resolve(output, "options", `option-${optIndex}.json`), {
			...opt,
		});

		optIndex++;
	}
};

const generateApps = async (output, apps) => {
	await clearCollection(path.resolve(output, "apps"));

	let appIndex = 0;
	for (const [name, app] of apps.entries()) {
		await write(path.resolve(output, "apps", `app-${appIndex}.json`), {
			name,
			...app,
		});

		appIndex++;
	}
};

const generateLib = async (output, lib) => {
	await clearCollection(path.resolve(output, "lib"));

	let libIndex = 0;
	for (const entry of lib.values()) {
		await write(path.resolve(output, "lib", `entry-${libIndex}.json`), {
			...entry.member,
			comment: entry.comment,
		});

		libIndex++;
	}
};

const generateShells = async (output, shells) => {
	await clearCollection(path.resolve(output, "shells"));
};

const generateMeta = async (output, flake, { snowfall, nix, uri }) => {
	await clearCollection(path.resolve(output, "meta"));

	const description = await getFlakeOutput(flake, "description");

	await write(path.resolve(output, "meta", "data.json"), {
		snowfall,
		flake: {
			uri,
			resolved: flake,
			nixConfig: nix,
			description,
		},
		modules: {
			nixos: await getFlakeModules(flake, "nixos"),
			darwin: await getFlakeModules(flake, "darwin"),
			home: await getFlakeModules(flake, "home"),
		},
	});
};

module.exports = {
	generatePackages,
	generateOptions,
	generateApps,
	generateLib,
	generateShells,
	generateMeta,
};
