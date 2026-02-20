const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Ensure proper Hermes bytecode handling
// This can fix "[runtime not ready]" errors during development
config.transformer = {
  ...config.transformer,
  // Enable inline requires to ensure modules are properly initialized
  inlineRequires: true,
};

module.exports = config;
