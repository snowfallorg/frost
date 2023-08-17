{ lib, buildNpmPackage }:

let
  package-json = lib.importJSON (lib.snowfall.fs.get-file "package.json");
in
buildNpmPackage {
  name = "frost";
  version = package-json.version;

  src = lib.snowfall.fs.get-file "/";

  npmDepsHash = "sha256-yr3Y1FMeHAQ7tsR1oumMC2G/rnXLs/Zg8bxxuOcEv/s=";

  dontNpmBuild = true;
}
