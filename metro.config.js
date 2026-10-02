const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

// Exclude collocated e2e and visual test files from Metro bundling and Expo Router route discovery
config.resolver.blockList = [
  ...defaultBlockList,
  /.*\.e2e\.[jt]sx?$/,
  /.*\.visual\.[jt]sx?$/,
];

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
