import { expect, test } from '@playwright/test';
import { transformSync } from '@babel/core';
import lucidePerIconImports from './lucide-per-icon-imports';

const transform = (code: string) =>
  transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: 'icons.tsx',
    plugins: [lucidePerIconImports],
    parserOpts: { plugins: ['typescript', 'jsx'] },
  })!.code;

test('imports each icon from its own module, aliases included', () => {
  expect(
    transform(
      "import { FolderPlus, Home as HomeIcon, Trash2 } from 'lucide-react-native';"
    )
  ).toBe(
    [
      'import FolderPlus from "lucide-react-native/icons/folder-plus";',
      'import HomeIcon from "lucide-react-native/icons/house";',
      'import Trash2 from "lucide-react-native/icons/trash";',
    ].join('\n')
  );
});

test('keeps types and non-icon exports on the root import', () => {
  expect(
    transform(
      "import { Pill, type LucideIcon, createLucideIcon } from 'lucide-react-native';\n" +
        "import type { LucideProps } from 'lucide-react-native';"
    )
  ).toBe(
    [
      "import { type LucideIcon, createLucideIcon } from 'lucide-react-native';",
      'import Pill from "lucide-react-native/icons/pill";',
      "import type { LucideProps } from 'lucide-react-native';",
    ].join('\n')
  );
});
