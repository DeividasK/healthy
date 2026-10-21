/**
 * Rewrites `import { FolderPlus } from 'lucide-react-native'` into one import
 * per icon module (`lucide-react-native/icons/folder-plus`).
 *
 * Metro bundles every module the root entry re-exports, so importing icons by
 * name ships all of lucide's icons (about 1.5 MB on web) for the few dozen the
 * app uses. Names are mapped through lucide's own export list, so aliases such
 * as `Home` (house) or `Trash2` (trash) resolve to the right file. Type imports
 * and names that are not icons stay on the root import.
 */
const fs = require('fs');
const path = require('path');

const PACKAGE = 'lucide-react-native';

/** Every icon export name, aliases included, mapped to its icon file. */
function readIconFiles() {
  // The package exports no package.json; its CommonJS entry sits in dist/cjs.
  const root = path.join(
    path.dirname(require.resolve(PACKAGE)),
    '../esm/lucide-react-native.mjs'
  );
  const files = new Map();
  const source = fs.readFileSync(root, 'utf8');
  for (const [, names, file] of source.matchAll(
    /export \{([^}]*)\} from '\.\/icons\/([a-z0-9-]+)\.mjs'/g
  ))
    for (const [, name] of names.matchAll(/default as (\w+)/g))
      files.set(name, file);
  return files;
}

module.exports = function lucidePerIconImports({ types: t }) {
  const iconFiles = readIconFiles();
  return {
    name: 'lucide-per-icon-imports',
    visitor: {
      ImportDeclaration(importPath) {
        const { node } = importPath;
        if (node.source.value !== PACKAGE || node.importKind === 'type') return;
        const kept = [];
        const iconImports = [];
        for (const specifier of node.specifiers) {
          const file =
            t.isImportSpecifier(specifier) &&
            specifier.importKind !== 'type' &&
            iconFiles.get(
              t.isIdentifier(specifier.imported)
                ? specifier.imported.name
                : specifier.imported.value
            );
          if (file)
            iconImports.push(
              t.importDeclaration(
                [t.importDefaultSpecifier(t.identifier(specifier.local.name))],
                t.stringLiteral(`${PACKAGE}/icons/${file}`)
              )
            );
          else kept.push(specifier);
        }
        if (iconImports.length === 0) return;
        if (kept.length === 0) {
          importPath.replaceWithMultiple(iconImports);
          return;
        }
        node.specifiers = kept;
        importPath.insertAfter(iconImports);
      },
    },
  };
};
