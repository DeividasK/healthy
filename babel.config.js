module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  // Bundles only the lucide icons the app imports.
  plugins.push('./babel/lucide-per-icon-imports');
  plugins.push('react-native-worklets/plugin');

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins,
  };
};
