const kleur = require("kleur");

module.exports = () => {
	// prettier-ignore
	const message = `
${kleur.bold().blue("frost")}

${kleur.bold("DESCRIPTION")}

  Generate documentation for a Nix Flake.

${kleur.bold("USAGE")}

  ${kleur.dim("$")} ${kleur.bold("frost")} <flake-uri> [options]

${kleur.bold("COMMANDS")}

  build                     Build documentation for a Nix Flake
  generate                  Generate static data for a Nix Flake

${kleur.bold("OPTIONS")}

  --help, -h                Show this help message
  --debug                   Show debug messages
  --show-trace              Show a trace when a Nix command fails
`;

	console.log(message);
};
