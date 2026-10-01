// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const { includeIgnoreFile } = require('@eslint/compat');
const expoConfig = require('eslint-config-expo/flat.js');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const path = require('node:path');

const gitignorePath = path.resolve(__dirname, '.gitignore');

module.exports = defineConfig([
  expoConfig,
  jsxA11y.flatConfigs.recommended,
  includeIgnoreFile(gitignorePath),
]);

