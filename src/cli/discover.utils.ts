import { relative } from "node:path";
import pc from "picocolors";
import ts from "typescript";

export type RouteInfo = {
  filePath: string;
  urlPath: string;
  isZouteX: boolean;
  declaredMethods: string[];
  exportedMethods: string[];
  missingExports: string[];
};

export function buildUrlPath(relPath: string): string {
  const withoutFile = relPath
    .replace(/route\.tsx?$/, "")
    .replace(/[/\\]+$/, "");
  const posixPath = withoutFile.split(/[/\\]/).join("/");
  return posixPath ? `/${posixPath}` : "/";
}

export function deriveUrlPath(filePath: string, appDir: string): string {
  return buildUrlPath(relative(appDir, filePath));
}

export function analyzeRouteContent(
  content: string,
  filePath: string,
  urlPath: string,
): RouteInfo {
  const sf = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  const defineRouteAliases = new Set<string>();
  const toNextHandlersAliases = new Set<string>();
  const toNextHandlerAliases = new Set<string>();
  let isZouteX = false;
  const declaredMethods: string[] = [];
  const exportedMethods: string[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const moduleSpec = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpec)) continue;
    const mod = moduleSpec.text;
    if (mod !== "zoutex" && mod !== "zoutex/next") continue;

    isZouteX = true;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const spec of bindings.elements) {
      const originalName = spec.propertyName?.text ?? spec.name.text;
      const localName = spec.name.text;
      if (originalName === "defineRoute") defineRouteAliases.add(localName);
      if (originalName === "toNextHandlers")
        toNextHandlersAliases.add(localName);
      if (originalName === "toNextHandler") toNextHandlerAliases.add(localName);
    }
  }

  for (const stmt of sf.statements) {
    collectDefinedMethods(stmt, defineRouteAliases, declaredMethods);
    collectExportedMethods(
      stmt,
      toNextHandlersAliases,
      toNextHandlerAliases,
      exportedMethods,
    );
  }

  const uniqueDeclared = [...new Set(declaredMethods)];
  const uniqueExported = new Set(exportedMethods);
  const missingExports = uniqueDeclared.filter((m) => !uniqueExported.has(m));

  return {
    filePath,
    urlPath,
    isZouteX,
    declaredMethods: uniqueDeclared,
    exportedMethods: [...uniqueExported],
    missingExports,
  };
}

function collectDefinedMethods(
  node: ts.Node,
  defineRouteAliases: Set<string>,
  out: string[],
): void {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    defineRouteAliases.has(node.expression.text)
  ) {
    const firstArg = node.arguments[0];
    if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
      for (const prop of firstArg.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === "method" &&
          ts.isStringLiteral(prop.initializer)
        ) {
          out.push(prop.initializer.text.toUpperCase());
        }
      }
    }
  }
  ts.forEachChild(node, (child) =>
    collectDefinedMethods(child, defineRouteAliases, out),
  );
}

function collectExportedMethods(
  stmt: ts.Statement,
  toNextHandlersAliases: Set<string>,
  toNextHandlerAliases: Set<string>,
  out: string[],
): void {
  if (!ts.isVariableStatement(stmt)) return;
  const isExported =
    stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ??
    false;
  if (!isExported) return;

  for (const decl of stmt.declarationList.declarations) {
    const init = decl.initializer;

    if (
      ts.isObjectBindingPattern(decl.name) &&
      init &&
      ts.isCallExpression(init) &&
      ts.isIdentifier(init.expression) &&
      toNextHandlersAliases.has(init.expression.text)
    ) {
      for (const el of decl.name.elements) {
        const propName = el.propertyName;
        const method = propName
          ? ts.isIdentifier(propName)
            ? propName.text
            : null
          : ts.isIdentifier(el.name)
            ? el.name.text
            : null;
        if (method) out.push(method.toUpperCase());
      }
      continue;
    }

    if (
      ts.isIdentifier(decl.name) &&
      init &&
      ts.isCallExpression(init) &&
      ts.isIdentifier(init.expression) &&
      toNextHandlerAliases.has(init.expression.text)
    ) {
      out.push(decl.name.text.toUpperCase());
    }
  }
}

export function printSummary(routes: RouteInfo[]): void {
  const COL_ROUTE = 30;
  const COL_TYPE = 10;
  const COL_METHODS = 24;

  const header =
    "     " +
    "Route".padEnd(COL_ROUTE) +
    "Type".padEnd(COL_TYPE) +
    "Methods".padEnd(COL_METHODS) +
    "Status";
  console.log(pc.dim(header));

  let zoutexCount = 0;
  let plainCount = 0;
  let errorCount = 0;

  for (const route of routes) {
    if (!route.isZouteX) {
      plainCount++;
      console.log(
        `  ${pc.dim("–")}  ` +
          pc.dim(route.urlPath.padEnd(COL_ROUTE)) +
          pc.dim("plain".padEnd(COL_TYPE)) +
          pc.dim("—"),
      );
      continue;
    }

    zoutexCount++;
    const hasMissing = route.missingExports.length > 0;
    if (hasMissing) errorCount++;

    const symbol = hasMissing ? pc.red("✗") : pc.green("✓");
    const urlDisplay = route.urlPath.padEnd(COL_ROUTE);
    const typeDisplay = "ZouteX".padEnd(COL_TYPE);
    const methods =
      route.declaredMethods.length > 0
        ? route.declaredMethods.join(", ")
        : "(none)";
    const methodsDisplay = methods.padEnd(COL_METHODS);

    let status: string;
    if (hasMissing) {
      const missing = route.missingExports.map((m) => pc.red(m)).join(", ");
      status = `${missing} not exported`;
    } else {
      status = pc.dim("all exported");
    }

    console.log(
      `  ${symbol}  ${urlDisplay}${typeDisplay}${methodsDisplay}${status}`,
    );
  }

  console.log();

  const summary = `${zoutexCount} route${zoutexCount !== 1 ? "s" : ""} use ZouteX, ${plainCount} plain.`;
  const errorSuffix =
    errorCount > 0
      ? ` ${pc.red(`${errorCount} validation error${errorCount !== 1 ? "s" : ""}.`)}`
      : pc.green(" No validation errors.");
  console.log(`${summary + errorSuffix}\n`);
}
