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
  // NativeWind's default ("last 1 version") still targets IE 11, so
  // autoprefixer emits `input:-ms-input-placeholder`. Expo's CSS pipeline
  // normalises that to `input:placeholder-shown`, which gives every empty
  // web input Tailwind's gray-400 placeholder colour as its text colour.
  browserslist: 'last 1 version, not dead',
});
