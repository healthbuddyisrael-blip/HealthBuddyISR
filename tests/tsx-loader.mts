import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

// Actual JSX components run in Node; Auth and database boundaries are not mocked.
const root = fileURLToPath(new URL("../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const base = resolve(root, specifier.slice(2));
      const file = [`${base}.tsx`, `${base}.ts`].find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      const file = [`${base}.tsx`, `${base}.ts`].find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(
      specifier === "next/link"
        ? "next/link.js"
        : specifier === "next/form"
          ? "next/form.js"
          : specifier === "next/navigation"
            ? "next/navigation.js"
            : specifier,
      context,
    );
  },
  load(url, context, next) {
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
