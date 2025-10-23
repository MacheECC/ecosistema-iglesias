import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ action }, { logger }) => {
  // Prove the hook loads
  logger.info('RLS hook loaded (filesystem hook)');

  // Example: log successful logins (keep it simple first)
  action('auth.login', async ({ user }) => {
    logger.info(`User logged in: ${user?.email ?? user?.id ?? 'unknown'}`);
  });
});