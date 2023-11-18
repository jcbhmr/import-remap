import assert from "node:assert/strict";

export default function importRemap(importMap, original, parentURL) {
	let specifier = original
  if (/\.?\.?\//.test(specifier)) {
    if (parentURL) {
      specifier = new URL(specifier, parentURL).href;
    } else {
      return specifier;
    }
  }

  function processSubMap(spec, subMap) {
    for (const [source, resolved] of Object.entries(subMap)) {
      if (source.endsWith("/") && resolved.endsWith("/")) {
        if (specifier.startsWith(source)) {
          return resolved + specifier.slice(source.length);
        }
      } else if (source === specifier) {
        return resolved;
      }
    }
  }

  const { imports, scopes } = importMap;
  if (imports) {
    const got = processSubMap(specifier, imports);
    if (got) {
      return got;
    }
  }
  if (parentURL && scopes) {
    for (const [scope, subMap] of Object.entries(scopes)) {
      if (
        scope === parentURL ||
        (scope.endsWith("/") && parentURL.startsWith(scope))
      ) {
        const got = processSubMap(specifier, subMap);
        if (got) {
          return got;
        }
      }
    }
  }

  return original;
}
