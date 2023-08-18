const kleur = require("kleur");

module.exports = () => {
	// prettier-ignore
	const message = `
${kleur.bold().blue("frost generate")}

${kleur.bold("DESCRIPTION")}

  Generate data for a Nix Flake's outputs.

${kleur.bold("USAGE")}

  ${kleur.dim("$")} ${kleur.bold("frost generate")} <flake-uri> [options]

${kleur.bold("OPTIONS")}

  --output, -o              An optional path to the output directory

  --help, -h                Show this help message
  --debug                   Show debug messages
  --show-trace              Show a trace when a Nix command fails

${kleur.bold("EXAMPLES")}

 ${kleur.dim("# Generate data for the cowsay flake.")}
 ${kleur.dim("$")} ${kleur.bold("frost generate")} github:snowfallorg/cowsay

 ${kleur.dim("# Output data to the my-data directory.")}
 ${kleur.dim("$")} ${kleur.bold("frost generate")} github:snowfallorg/cowsay --output my-data
`;

	console.log(message);
};
