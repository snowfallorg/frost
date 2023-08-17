const fs = require("fs/promises");
const path = require("path");
const { rimraf } = require("rimraf");
const { mkdirp } = require("mkdirp");

const resolvePath = (file) => {
	if (path.isAbsolute(file)) {
		return file;
	} else {
		return path.resolve(file);
	}
};

const exists = async (file) => {
	try {
		await fs.stat(file);

		return true;
	} catch (error) {
		return false;
	}
};

const readDir = async (dir) => {
	const files = await fs.readdir(dir);

	return files.map((file) => path.join(dir, file));
};

const readDirRecursive = async (dir) => {
	const all = await readDir(dir);

	const files = [];

	for (const file of all) {
		const stat = await fs.lstat(file);

		if (stat.isDirectory()) {
			files.push(...(await readDirRecursive(file)));
		} else {
			files.push(file);
		}
	}

	return files;
};

const write = async (file, value, { pretty = false, encoding = "utf8", ...options } = {}) => {
	if (typeof value !== "string") {
		value = JSON.stringify(value);
	}

	await fs.writeFile(file, value, { encoding, ...options });
};

const clearCollection = async (collection) => {
	await rimraf(collection);
	await mkdirp(collection);
};

module.exports = {
	resolvePath,
	exists,
	readDir,
	readDirRecursive,
	write,
	clearCollection,
};
