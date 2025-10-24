export default ({ filter, action }, { database, logger }) => {
  //
  // 1. EARLY HOOK: runs before Directus actually handles the request
  //    and before it does item queries.
  //
  filter('authenticate', async (payload, meta, { accountability, database }) => {
    const userId = accountability?.user || '';
    const isAdmin = !!accountability?.admin;

    // Build list of iglesias for this user
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

    // Set per-request GUCs on THIS request's DB connection
    try {
      await database.raw(`SELECT set_config('app.user_id', ?, false)`, [userId]);
      await database.raw(`SELECT set_config('app.is_super_admin', ?, false)`, [isAdmin ? 'true' : 'false']);
      await database.raw(`SELECT set_config('app.allowed_iglesias', ?, false)`, [allowedCSV]);
    } catch (e) {
      logger?.warn?.(`[rls] set_config failed: ${e?.message || e}`);
    }

    // 🔍 DEBUG: immediately read them back from the SAME connection
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
    });

    // You MUST return payload in a filter hook
    return payload;
  });

  //
  // 2. LATE HOOK: after Directus sends the response.
  //    We use this to clean up so pooled connections don’t leak user info.
  //
  action('response', async (_meta, { database }) => {
    try {
      await database.raw(`RESET app.user_id`);
      await database.raw(`RESET app.is_super_admin`);
      await database.raw(`RESET app.allowed_iglesias`);
    } catch (e) {
      logger?.warn?.(`[rls] RESET failed: ${e?.message || e}`);
    }
  });
};