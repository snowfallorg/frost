{
  description = "My Nix packages";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-23.05";
    unstable.url = "github:nixos/nixpkgs/nixos-unstable";

    snowfall-lib = {
      url = "github:snowfallorg/lib/dev";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    nmd.url = "sourcehut:~rycee/nmd/824a380546b5d0d0eb701ff8cd5dbafb360750ff";
  };

  outputs = inputs:
    inputs.snowfall-lib.mkFlake {
      inherit inputs;

      src = ./.;

      snowfall = {
        root = ./nix;
        namespace = "snowfallorg";
      };

      alias.packages = {
        default = "frost";
      };
    };
}
