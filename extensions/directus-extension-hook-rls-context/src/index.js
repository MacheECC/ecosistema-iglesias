/* export default ({ logger }) => {
	console.log('RLS HOOK: packaged hook file was loaded')
}; */

//import { defineHook } from 'directus/extensions';

// index.js
export default ({ action }, { database, logger }) => {
  logger?.info?.('RLS HOOK: packaged hook file was loaded');

  // Prefer scoping to a single request rather than all events:
  action('request.start', async (_payload, { accountability }) => {
    const userId = accountability?.user || '';
    const isAdmin = !!accountability?.admin;

    // Compute allowed iglesias as CSV
    let allowedCSV = '';
    try {
      if (userId) {
        const rows = await database.raw(
          `
          SELECT array_to_string(array_agg(iglesia_id::text), ',') AS csv
          FROM public.usuarios_iglesias
          WHERE user_id = ?
          `,
          [userId]
        );
        const rec = (rows?.rows && rows.rows[0]) || rows?.[0] || {};
        allowedCSV = rec?.csv || '';
      }
    } catch (e) {
      logger?.warn?.(`[set-rls-context] lookup failed: ${e?.message || e}`);
      allowedCSV = '';
    }

    // Use set_config(...) so we can pass bind params safely
    try {
      // session-scope so Directus queries see them even outside a txn
      await database.raw(`SELECT set_config('app.user_id', ?, false)`, [userId]);
      await database.raw(`SELECT set_config('app.is_super_admin', ?, false)`, [isAdmin ? 'true' : 'false']);
      await database.raw(`SELECT set_config('app.allowed_iglesias', ?, false)`, [allowedCSV]);
    } catch (e) {
      logger?.warn?.(`[set-rls-context] set_config failed: ${e?.message || e}`);
    }

    // Cleanup after the request completes so pool connections don't leak state
    return async () => {
      try {
        await database.raw(`RESET app.user_id`);
        await database.raw(`RESET app.is_super_admin`);
        await database.raw(`RESET app.allowed_iglesias`);
      } catch (e) {
        logger?.warn?.(`[set-rls-context] RESET failed: ${e?.message || e}`);
      }
    };
  });
};