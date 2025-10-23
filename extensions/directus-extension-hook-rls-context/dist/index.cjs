const { defineHook } = require('directus/dist/utils/define-extension');

module.exports = defineHook(({ init }) => {
  init('app.before', () => {
    console.log('✅ Hook loaded successfully');
  });
});