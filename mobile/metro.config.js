const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Workaround for Metro package-exports incompatibilities that can manifest as
// “[runtime not ready] … require doesn’t exist”
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
