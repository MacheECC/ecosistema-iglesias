// dist/index.cjs (CommonJS)
const { defineHook } = require('@directus/extensions-sdk');

module.exports = defineHook(({ logger }) => ({
  'app.after': async () => {
    logger.info('RLS HOOK: filesystem hook file was loaded');
  },
}));