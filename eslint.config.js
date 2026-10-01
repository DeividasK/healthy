// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const { includeIgnoreFile } = require('@eslint/compat');
const expoConfig = require('eslint-config-expo/flat.js');
const path = require('node:path');

const gitignorePath = path.resolve(__dirname, '.gitignore');

module.exports = defineConfig([
  expoConfig,
  includeIgnoreFile(gitignorePath),
]);
