import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ action }, { logger }) => {
  logger.info('RLS HOOK: filesystem hook file was loaded'); // you'll see this in logs
  action('items.read', (meta, ctx) => {
    // your logic here, or keep empty to just prove it loads
  });
});