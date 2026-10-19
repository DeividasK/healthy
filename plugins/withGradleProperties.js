const { withGradleProperties } = require('expo/config-plugins');

const PROPERTIES = {
  // The generated gradle.properties caps Metaspace at 512 MB, which release
  // builds exhaust during Android lint (lintVitalAnalyzeRelease).
  'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
  // Reuse task outputs from earlier builds; CI restores the cache from main.
  'org.gradle.caching': 'true',
};

module.exports = function withHealthyGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = props.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) existing.value = value;
      else props.push({ type: 'property', key, value });
    }
    return config;
  });
};
