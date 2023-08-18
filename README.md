# Snowfall Frost

<a href="https://nixos.wiki/wiki/Flakes" target="_blank">
	<img alt="Nix Flakes Ready" src="https://img.shields.io/static/v1?logo=nixos&logoColor=d8dee9&label=Nix%20Flakes&labelColor=5e81ac&message=Ready&color=d8dee9&style=for-the-badge">
</a>
<a href="https://github.com/snowfallorg/lib" target="_blank">
	<img alt="Built With Snowfall" src="https://img.shields.io/static/v1?label=Built%20With&labelColor=5e81ac&message=Snowfall&color=d8dee9&style=for-the-badge">
</a>

<p>
<!--
	This paragraph is not empty, it contains an em space (UTF-8 8195) on the next line in order
	to create a gap in the page.
-->
  
</p>

> Generate documentation for Nix Flakes.

## Installation

### Nix Profile

You can install this package imperatively with the following command.

```bash
nix profile install github:snowfallorg/frost
```

### Nix Configuration

You can install this package by adding it as an input to your Nix Flake.

```nix
{
	description = "My system flake";

	inputs = {
		nixpkgs.url = "github:nixos/nixpkgs/nixos-23.05";
		unstable.url = "github:nixos/nixpkgs/nixos-unstable";

		# Snowfall Lib is not required, but will make configuration easier for you.
		snowfall-lib = {
			url = "github:snowfallorg/lib";
			inputs.nixpkgs.follows = "nixpkgs";
		};

		snowfall-frost = {
			url = "github:snowfallorg/frost";
			inputs.nixpkgs.follows = "nixpkgs";
		};
	};

	outputs = inputs:
		inputs.snowfall-lib.mkFlake {
			inherit inputs;
			src = ./.;

			overlays = with inputs; [
				# Use the default overlay provided by this flake.
				snowfall-frost.overlays.default

				# There is also a named overlay, though the output is the same.
				snowfall-frost.overlays."package/frost"
			];
		};
}
```

If you've added the overlay from this flake, then in your system configuration you
can add the `snowfallorg.frost` package.

```nix
{ pkgs }:

{
	environment.systemPackages = with pkgs; [
		snowfallorg.frost
	];
}
```

## Usage

### `frost build`

Build documentation for a given flake.

```bash

frost build github:snowfallorg/cowsay
```
