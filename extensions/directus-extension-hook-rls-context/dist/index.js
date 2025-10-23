import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ logger }) => {
  logger.info('RLS HOOK: packaged hook file was loaded');
  // Add your hook registrations here, for example:
  // on('items.read', 'iglesias', async (event) => { ... });
});