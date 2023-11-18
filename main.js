#!/usr/bin/env node
import { parseArgs } from "node:util";
import { stat, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { glob } from "glob";
import * as esmlexer from "es-module-lexer";
await esmlexer.init;
import importRemap from "./index.js";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import commonAncestorPath from "common-ancestor-path";
import { basename, relative } from "node:path";
import.meta.resolve ??= (s) => new URL(s, import.meta.url).href;

const pkg = await readFile(
  new URL(import.meta.resolve("./package.json")),
  "utf8",
);

/** @satisfies {import('node:util').ParseArgsConfig['options']} */
const options = {
  help: { type: "boolean" },
  version: { type: "boolean" },
  // write: { type: "boolean", short: "w" },
  // "in-place": { type: "boolean", short: "i" },
  outdir: { type: "string", short: "o" },
  ignore: { type: "string", multiple: true },
  "import-map": { type: "string" },
};
const { values, positionals } = parseArgs({ options, allowPositionals: true });

main: {
  if (values.help) {
    console.log(helpText);
    break main;
  }
  if (values.version) {
    console.log(pkg.version);
    break main;
  }

  let importMapPath = values["import-map"];
  if (!importMapPath) {
    const detectImportMapPath = ["deno.json", "import_map.json"].find((x) =>
      existsSync(x),
    );
    if (!detectImportMapPath) {
      throw new DOMException(
        `no deno.json or import_map.json detected. must use --import-map manually.`,
      );
    }
    importMapPath = detectImportMapPath;
  }
  const importMap = JSON.parse(await readFile(importMapPath, "utf8"));

  const files = await glob(positionals, { nodir: true, ignore: values.ignore });

  const ancestor = commonAncestorPath(files);

  for (const file of files) {
    let js = await readFile(file, "utf8");
    const [imports, exports] = esmlexer.parse(js);
    let offset = 0;
    for (const thing of imports) {
      let { s: start, e: end, n: name } = thing;
      start += offset;
      end += offset;
      const before = js.slice(0, start);
      const after = js.slice(end);
      const spec = name;
      const url = pathToFileURL(file);
      const replacement = importRemap(importMap, spec, url);
      offset += replacement.length - spec.length;
      js = before + replacement + after;
    }
    if (values.outdir) {
      const rel = relative(ancestor, file);
      const outfile = join(values.outdir, rel);
      await mkdir(basename(outfile), { recursive: true });
      await writeFile(outfile, js);
    } else {
      console.log(`${file}:\n${js}\n`);
    }
  }
}
