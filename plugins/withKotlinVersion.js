const { withProjectBuildGradle } = require("@expo/config-plugins");

module.exports = function withKotlinVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /kotlinVersion\s*=\s*["'].*["']/,
      'kotlinVersion = "1.9.25"'
    );
    if (!config.modResults.contents.includes('kotlinVersion = "1.9.25"')) {
      config.modResults.contents = config.modResults.contents.replace(
        "ext {",
        'ext {\n        kotlinVersion = "1.9.25"'
      );
    }
    return config;
  });
};
