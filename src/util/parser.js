const fs = require("fs/promises");
const path = require("path");
const {
	NodeKind,
	Parser,
	isAttrBinding,
	isInheritBinding,
	isDestructuredFnParams,
	isIdentifierFnParams,
} = require("@snowfallorg/sleet");
const log = require("./log");

const parse = (code) => {
	const parser = new Parser();

	return parser.parse(code);
};

const parseFile = async (file) => {
	log.trace({ status: "parsing", file });
	const code = await fs.readFile(file, {
		encoding: "utf8",
	});

	return parse(code);
};

const traverse = (ast, visitor) => {
	visitor[ast.kind]?.(ast);

	switch (ast.kind) {
		case NodeKind.Root:
			traverse(ast.value, visitor);
			break;
		case NodeKind.Expr:
			traverse(ast.value, visitor);
			break;
		case NodeKind.SubExpr:
			traverse(ast.value, visitor);
			break;
		case NodeKind.Fn:
			traverse(ast.args, visitor);
			traverse(ast.body, visitor);
			break;
		case NodeKind.FnParams:
			if (isDestructuredFnParams(ast)) {
				if (ast.as) {
					traverse(ast.as, visitor);
				}
				for (const param of ast.value) {
					traverse(param, visitor);
				}
			} else {
				traverse(ast.name, visitor);
			}
			break;
		case NodeKind.FnParam:
			traverse(ast.name, visitor);
			if (ast.default) {
				traverse(ast.default, visitor);
			}
			break;
		case NodeKind.LetIn:
			for (const binding of ast.bindings) {
				traverse(binding, visitor);
			}
			traverse(ast.body, visitor);
			break;
		case NodeKind.Attrs:
			for (const attr of ast.value) {
				traverse(attr, visitor);
			}
			break;
		case NodeKind.Attr:
			if (isInheritBinding(ast)) {
				if (ast.from) {
					traverse(ast.from, visitor);
				}

				for (const ident of ast.value) {
					traverse(ident, visitor);
				}
			} else {
				traverse(ast.name, visitor);
				traverse(ast.value, visitor);
			}
			break;
		case NodeKind.FnCall:
			traverse(ast.name, visitor);

			for (const arg of ast.value) {
				traverse(arg, visitor);
			}
			break;
		case NodeKind.String:
			for (const part of ast.value) {
				if (typeof part !== "string") {
					traverse(part, visitor);
				}
			}
			break;
		case NodeKind.Conditional:
			traverse(ast.condition, visitor);
			traverse(ast.then, visitor);
			traverse(ast.else, visitor);
			break;
		case NodeKind.BinaryExpr:
			traverse(ast.op, visitor);
			traverse(ast.left, visitor);
			traverse(ast.right, visitor);
			break;
		case NodeKind.UnaryExpr:
			traverse(ast.op, visitor);
			traverse(ast.value, visitor);
			break;
		case NodeKind.Interp:
			traverse(ast.value, visitor);
			break;
		case NodeKind.List:
			for (const item of ast.value) {
				traverse(item, visitor);
			}
			break;
		case NodeKind.Import:
			traverse(ast.value, visitor);
			break;
		case NodeKind.Null:
		case NodeKind.Identifier:
		case NodeKind.Bool:
		case NodeKind.Int:
		case NodeKind.Float:
		case NodeKind.Not:
		case NodeKind.EqEq:
		case NodeKind.NotEq:
		case NodeKind.Add:
		case NodeKind.Sub:
		case NodeKind.Mul:
		case NodeKind.Div:
		case NodeKind.Update:
		case NodeKind.Concat:
		case NodeKind.Fallback:
		case NodeKind.Has:
		case NodeKind.Or:
		case NodeKind.And:
		case NodeKind.Gt:
		case NodeKind.Gte:
		case NodeKind.Lt:
		case NodeKind.Lte:
		case NodeKind.Path:
			break;
		default:
			console.log(ast.kind);
			console.log(ast);
			process.exit(1);
			break;
	}
};

module.exports = {
	parse,
	parseFile,
	traverse,
};
