const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  maxWorkers: 2,
  resolver: {
    // Build outputs and backup archives are not application assets.
    blockList: [
      /[/\\]android[/\\](?:app[/\\])?build[/\\].*/,
      /[/\\]android[/\\]\.gradle[/\\].*/,
      /[/\\]ios[/\\](?:build|Pods)[/\\].*/,
      /.*\.zip$/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
