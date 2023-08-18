const kleur = require("kleur");

module.exports = () => {
	// prettier-ignore
	const message = `
${kleur.bold().blue("frost build")}

${kleur.bold("DESCRIPTION")}

  Build documentation for a Nix Flake.

${kleur.bold("USAGE")}

  ${kleur.dim("$")} ${kleur.bold("frost build")} <flake-uri> [options]

${kleur.bold("OPTIONS")}

  --output, -o              An optional path to the output directory
  --base, -b                An optional base URL path to serve
  --ui                      An optional Flake URI for the Frost UI flake

  --help, -h                Show this help message
  --debug                   Show debug messages
  --show-trace              Show a trace when a Nix command fails

${kleur.bold("EXAMPLES")}

 ${kleur.dim("# Build documentation for the cowsay flake.")}
 ${kleur.dim("$")} ${kleur.bold("frost build")} github:snowfallorg/cowsay

 ${kleur.dim("# Output documentation to the my-docs directory.")}
 ${kleur.dim("$")} ${kleur.bold("frost build")} github:snowfallorg/cowsay --output my-docs

 ${kleur.dim("# Serve built documentation at the URL path `/docs`.")}
 ${kleur.dim("$")} ${kleur.bold("frost build")} github:snowfallorg/cowsay --base /docs

 ${kleur.dim("# Use a different version of Frost UI.")}
 ${kleur.dim("$")} ${kleur.bold("frost build")} github:snowfallorg/cowsay --ui 'github:snowfallorg/frost-ui?ref=commit123'
`;

	console.log(message);
};
