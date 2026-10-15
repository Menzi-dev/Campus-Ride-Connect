// Client build configuration: use the Expo Babel preset to transform the app code for its build
// pipeline.
// Where: the exported Babel configuration in mobile/babel.config.js.
// How: api.cache(true) caches this configuration and babel-preset-expo supplies the Expo code
// transformations.
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
