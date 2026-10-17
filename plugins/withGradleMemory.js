const { withGradleProperties } = require('expo/config-plugins');

// The generated gradle.properties caps Metaspace at 512 MB, which release
// builds exhaust during Android lint (lintVitalAnalyzeRelease).
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const existing = props.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );
    if (existing) existing.value = JVM_ARGS;
    else
      props.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: JVM_ARGS,
      });
    return config;
  });
};
