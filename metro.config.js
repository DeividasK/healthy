const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

// Exclude e2e and visual test files from Metro bundling
config.resolver.blockList = [
  ...defaultBlockList,
  /.*\.e2e\.[jt]sx?$/,
  /.*\.visual\.[jt]sx?$/,
];

// Enable WebAssembly asset bundling for expo-sqlite web support
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'wasm'];

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
