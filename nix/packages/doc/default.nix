{ inputs, pkgs, lib, ... }:

let
  # target = inputs.snowfall-lib;
  target = builtins.getFlake "path:/home/short/work/config";
  target-modules = {
    nixos = target.nixosModules or { };
  };

  nmd = lib.nmd.${pkgs.system};

  buildModulesDocs = args @ { channelName, moduleRootPaths, mkModuleUrl, modules, docBook ? { } }:
    let
      evaluated-modules = lib.evalModules { inherit modules; };

      replace-fn = value:
        if builtins.isAttrs value then
          lib.mapAttrs (name: replace-fn) value
        else if builtins.isList value then
          builtins.map replace-fn value
        else if builtins.isFunction value then
          "<function>"
        else
          value;

      strip-store-path = path:
        let
          parts = builtins.split "^/nix/store/[[:lower:][:digit:]]{32}-[^\\/]+/?" path;
          string-parts = builtins.filter (builtins.isString) parts;
        in
        builtins.concatStringsSep "" string-parts;

      strip-module-path-prefixes =
        let
          prefixes = builtins.map (p: "${builtins.toString p}/") moduleRootPaths;
          strip = path: lib.fold lib.removePrefix (strip-store-path path) prefixes;
        in
        path: strip path;

      create-declaration = decl: rec {
        path = strip-module-path-prefixes decl;
        url = mkModuleUrl path;
        channelPath = "${channelName}/${path}";
      };

      create-related-packages =
        let
          unpack = p:
            if builtins.isString p then
              { name = p; }
            else if builtins.isList p then
              { path = p; }
            else p;
          repack = args:
            let
              name = args.name or (lib.concatStringsSep "." args.path);
              path = args.path or [ args.name ];
              pkg = args.package or (
                let
                  bail = builtins.throw "Invalid package attribute path '${builtins.toString path}'";
                in
                lib.attryByPath path bail pkgs
              );
            in
            {
              attrName = name;
              packageName = pkg.meta.name;
              available = pkg.meta.available;
            } // lib.optionalAttrs (pkg.meta ? description) {
              inherit (pkg.meta) description;
            } // lib.optionalAttrs (pkg.meta ? longDescription) {
              inherit (pkg.meta) longDescription;
            } // lib.optionalAttrs (args ? comment) {
              inherit (args) comment;
            };
        in
        builtins.map (p: repack (unpack p));

      clean-up-option = opt:
        let
          apply-on-attr = n: f:
            lib.optionalAttrs
              (builtins.hasAttr n opt)
              { ${n} = f opt.${n}; };
        in
        opt
        // apply-on-attr "declarations" (builtins.map create-declaration)
        // apply-on-attr "example" replace-fn
        // apply-on-attr "default" replace-fn
        // apply-on-attr "type" replace-fn
        // apply-on-attr "relatedPackages" create-related-packages;

      module-docs-compare = a: b:
        let
          is-enable = lib.hasPrefix "enable";
          is-package = lib.hasPrefix "package";
          compare-with-prio = pred: cmp: lib.splitByAndCompare pred lib.compare cmp;
          module-cmp = compare-with-prio is-enable (compare-with-prio is-package lib.compare);
        in
        lib.compareLists module-cmp a.loc b.loc < 0;

      raw-options-docs = (builtins.map clean-up-option
        (builtins.sort module-docs-compare
          (builtins.filter (opt: opt.visible && !opt.internal)
            (lib.optionAttrSetToDocList evaluated-modules.options)
          )
        )
      );

      raw-options-json = builtins.toJSON raw-options-docs;
      raw-options-json-file = pkgs.runCommandNoCC "options.json"
        {
          src = builtins.toFile "options.json" raw-options-json;
        } ''
        ln -s $src $out
      '';
    in
    {
      inherit raw-options-docs;
      raw-json = raw-options-json;
      raw-json-file = raw-options-json-file;
    } // (nmd.buildModulesDocs args);

  sink-module = {
    options = {
      environment = pkgs.lib.mkSinkUndeclaredOptions { };
      systemd = pkgs.lib.mkSinkUndeclaredOptions { };
      system = pkgs.lib.mkSinkUndeclaredOptions { };
      users = pkgs.lib.mkSinkUndeclaredOptions { };
      programs = pkgs.lib.mkSinkUndeclaredOptions { };
      boot = pkgs.lib.mkSinkUndeclaredOptions { };
      console = pkgs.lib.mkSinkUndeclaredOptions { };
      fonts = pkgs.lib.mkSinkUndeclaredOptions { };
      hardware = pkgs.lib.mkSinkUndeclaredOptions { };
      i18n = pkgs.lib.mkSinkUndeclaredOptions { };
      nix = pkgs.lib.mkSinkUndeclaredOptions { };
      security = pkgs.lib.mkSinkUndeclaredOptions { };
      services = pkgs.lib.mkSinkUndeclaredOptions { };
      time = pkgs.lib.mkSinkUndeclaredOptions { };
      xdg = pkgs.lib.mkSinkUndeclaredOptions { };
    };
  };

  scrubbed-pkgs-module = {
    _module.args = {
      pkgs = pkgs.lib.mkForce (nmd.scrubDerivations "pkgs" pkgs);
      pkgs_i686 = pkgs.lib.mkForce { };
    };
  };

  dont-check-module = {
    _module.check = lib.mkForce false;
  };

  docs = buildModulesDocs {
    docBook = { };
    channelName = "nixpkgs";
    moduleRootPaths = [ target ];
    mkModuleUrl = path: "https://example.com/${path}";

    modules = (builtins.attrValues target-modules.nixos) ++ [
      sink-module
      scrubbed-pkgs-module
      dont-check-module
    ];
  };
in
# docs.json
docs.raw-json-file
