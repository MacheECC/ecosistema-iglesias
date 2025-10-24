export default ({ filter, action }, { logger }) => {
  // This runs BEFORE Directus actually queries the DB for any collection
  filter('items.read', async (query, meta, context) => {
    const { accountability, database } = context;
    // meta.collection tells you which collection is being read
    // query is the query object Directus will use

    const userId = accountability?.user || '';
    const isAdmin = !!accountability?.admin;

    // Build CSV of allowed iglesias
    let allowedCSV = '';
    if (userId) {
      try {
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
      } catch (e) {
        logger?.warn?.(`[rls] lookup failed: ${e?.message || e}`);
      }
    }

    // Now set per-connection configs safely
    try {
      await database.raw(`SELECT set_config('app.user_id', ?, false)`, [userId || '']);
      await database.raw(
        `SELECT set_config('app.is_super_admin', ?, false)`,
        [isAdmin ? 'true' : 'false']
      );
      await database.raw(`SELECT set_config('app.allowed_iglesias', ?, false)`, [allowedCSV || '']);
    } catch (e) {
      logger?.warn?.(`[rls] set_config failed: ${e?.message || e}`);
    }

    // Debug log (this is what you were doing)
    const check = await database.raw(
      `
      SELECT
        current_setting('app.user_id', true)          AS user_id,
        current_setting('app.is_super_admin', true)   AS is_super_admin,
        current_setting('app.allowed_iglesias', true) AS allowed_iglesias
      `
    );

    logger?.info?.({
      msg: '[rls] context after set_config',
      check: check?.rows?.[0],
      req_user: userId,
      collection: meta.collection,
    });

    // Important: return the (possibly modified) query so Directus continues.
    return query;
  });

  // Cleanup after the response so pooled connections don't leak the previous user's context
  action('response', async (_payload, { database }) => {
    try {
      await database.raw(`RESET app.user_id`);
      await database.raw(`RESET app.is_super_admin`);
      await database.raw(`RESET app.allowed_iglesias`);
    } catch (e) {
      logger?.warn?.(`[rls] RESET failed: ${e?.message || e}`);
    }
  });
};