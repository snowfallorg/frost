const { promisify } = require("util");
const childProcess = require("child_process");

const exec = promisify(childProcess.exec);

const NIX_STORE_REGEX = /^\/nix\/store\/[\w\d]{32}-[^\/]+(?:\/(.+))?$/;

const isStorePath = (file) => {
	return NIX_STORE_REGEX.test(file);
};

const stripStorePath = (file) => {
	return file.replace(NIX_STORE_REGEX, "$1");
};

const escapeNixExpression = (code) => code.replaceAll(/'/g, "'\\''");

const prelude = `
	let
		prelude = {
			system = builtins.currentSystem;

			flatten = value:
				if builtins.isList value then
					builtins.concatMap prelude.flatten value
				else
					[value];

			has-prefix = prefix: text:
				(builtins.substring 0 (builtins.stringLength prefix) text) == prefix;

			map-attrs-to-list = f: attrs:
				builtins.map (name: f name attrs.\${name}) (builtins.attrNames attrs);

			name-value-pair = name: value: { inherit name value; };

			filter-attrs = predicate: attrs:
				builtins.listToAttrs
					(builtins.concatMap
						(name:
							if predicate name attrs.\${name} then
								[(prelude.name-value-pair name attrs.\${name})]
							else
								[]
						)
						(builtins.attrNames attrs)
					);

			get-flake = path:
				let
					is-path = (prelude.has-prefix "/" path) || (prelude.has-prefix "." path);
					flake-uri = if is-path then "path:\${builtins.toString path}" else path;
				in
					builtins.getFlake flake-uri;
		};
	in
`;

const eval = async (code, options = {}) => {
	const { json = true, impure = true, ...execOptions } = options;

	const expression = [prelude, code].map(escapeNixExpression).join("\n");

	const command = `nix eval --show-trace ${json ? "--json" : ""} ${impure ? "--impure" : ""} --expr '${expression}'`;

	const output = await exec(command, {
		...execOptions,
	});

	return output;
};

const getFlakeOutputs = async (flake) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
in
	builtins.attrNames flake
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakeOutput = async (flake, name) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
in
	flake.${name} or null
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakeOutputAttrs = async (flake, name) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
in
	builtins.attrNames (flake.${name} or {})
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakeModules = async (flake, system = "nixos") => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
in
	builtins.attrNames (flake.${system}Modules or {})
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getSnowfallConfig = async (flake) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
in
	flake._snowfall.config or null
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakeLibMembers = async (flake) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
	lib = flake.lib or flake._snowfall.internal.user-lib or flake._snowfall.internal-lib or {};
	get-members = path: attrs:
		let
			process = name: value:
				if builtins.isAttrs value then
					get-members (path ++ [ name ]) value
				else
					{
						inherit name path;
						type = builtins.typeOf value;
						location = builtins.unsafeGetAttrPos name attrs;
					};

			filtered-attrs = prelude.filter-attrs
				(name: value: (!prelude.has-prefix "_" name))
				attrs;
		in
			prelude.flatten (prelude.map-attrs-to-list process filtered-attrs);

	without-extend-helpers = members:
		builtins.filter
			(value:
				if builtins.length value.path == 0 then
					(value.name != "overrideDerivation")
				else
					true
			)
			members;

	raw-members = get-members [] lib;

	members = without-extend-helpers raw-members;
in
	members
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakePackages = async (flake) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
	packages = flake.packages or {};

	get-system-package = system: name: package: {
		inherit system name;
		meta = package.meta or null;
	};

	get-system-packages = system: attrs:
		prelude.map-attrs-to-list (get-system-package system) attrs;

	results = prelude.flatten (prelude.map-attrs-to-list (get-system-packages) packages);
in
	results
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakeApps = async (flake) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
	apps = flake.apps or {};

	get-system-app = system: name: app: {
		inherit system name;
	};

	get-system-apps = system: attrs:
		prelude.map-attrs-to-list (get-system-app system) attrs;

	results = prelude.flatten (prelude.map-attrs-to-list (get-system-apps) apps);
in
	results
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

const getFlakeModuleOptions = async (flake, { channelName = "<nixpkgs>", moduleUrl = "/" } = {}) => {
	const code = `
let
	flake = prelude.get-flake "${flake}";
	nmd-flake = prelude.get-flake "sourcehut:~rycee/nmd/824a380546b5d0d0eb701ff8cd5dbafb360750ff";
	nixpkgs = flake.inputs.nixpkgs;
	pkgs = nixpkgs.legacyPackages.\${prelude.system};
	lib = pkgs.lib;
  target = flake;
  target-modules = {
    nixos = target.nixosModules or { };
  };

  nmd = nmd-flake.lib.\${pkgs.system};

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
          parts = builtins.split "^/nix/store/[[:lower:][:digit:]]{32}-[^\\\\/]+/?" path;
          string-parts = builtins.filter (builtins.isString) parts;
        in
        builtins.concatStringsSep "" string-parts;

      strip-module-path-prefixes =
        let
          prefixes = builtins.map (p: "\${builtins.toString p}/") moduleRootPaths;
          strip = path: lib.fold lib.removePrefix (strip-store-path path) prefixes;
        in
        path: strip path;

      create-declaration = decl: rec {
        path = strip-module-path-prefixes decl;
        url = mkModuleUrl path;
        channelPath = "\${channelName}/\${path}";
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
                  bail = builtins.throw "Invalid package attribute path '\${builtins.toString path}'";
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
              { \${n} = f opt.\${n}; };
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
      raw-json = raw-options-json;
      raw-json-file = raw-options-json-file;
			inherit raw-options-docs;
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
    channelName = "${channelName}";
    moduleRootPaths = [ target ];
    mkModuleUrl = path: "${moduleUrl}\${path}";

    modules = (builtins.attrValues target-modules.nixos) ++ [
      sink-module
      scrubbed-pkgs-module
      dont-check-module
    ];
  };
in
docs.raw-options-docs
	`;

	const output = await eval(code);

	return JSON.parse(output.stdout);
};

module.exports = {
	prelude,
	eval,
	isStorePath,
	stripStorePath,
	getFlakeModules,
	getSnowfallConfig,
	getFlakeOutputs,
	getFlakeOutputAttrs,
	getFlakeOutput,
	getFlakeLibMembers,
	getFlakePackages,
	getFlakeApps,
	getFlakeModuleOptions,
};
