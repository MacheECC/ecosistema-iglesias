const { defineHook } = require('@directus/extensions-sdk');

module.exports = defineHook(({ init }) => {
  init('app.before', () => {
    console.log('✅ Hook loaded successfully');
  });
});