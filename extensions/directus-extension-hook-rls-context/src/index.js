export default ({ filter, action }, { logger }) => {
  logger?.info?.('[rls] hook loaded');

  // We'll use this UUID as a harmless "nobody" value instead of ''.
  // It's a valid UUID so Postgres won't throw 22P02.
  const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

  async function setRlsContextForRequest({ accountability, database }, collectionForLog) {
    // 1. Who is the user?
    const userId = accountability?.user || '';
    const isAdmin = !!accountability?.admin;

    // 2. Which iglesias can they see?
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

    // 3. Use safe fallbacks so Postgres never has to cast "" to uuid
    const effectiveUserId = userId || EMPTY_UUID;
    // If they have no iglesias, give them a CSV with just EMPTY_UUID.
    // Your RLS policy will check membership and won't match any real iglesia_id.
    const effectiveAllowed = allowedCSV || EMPTY_UUID;

    // 4. Store values in session GUCs for this DB connection
    try {
      await database.raw(`SELECT set_config('app.user_id', ?, false)`, [effectiveUserId]);
      await database.raw(`SELECT set_config('app.is_super_admin', ?, false)`, [isAdmin ? 'true' : 'false']);
      await database.raw(`SELECT set_config('app.allowed_iglesias', ?, false)`, [effectiveAllowed]);
    } catch (e) {
      logger?.warn?.(`[rls] set_config failed: ${e?.message || e}`);
    }

    // 5. Debug: read them back immediately from this same connection
    try {
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
        req_user: userId || '(public/none)',
        collection: collectionForLog,
      });
    } catch (e) {
      logger?.warn?.(`[rls] verify failed: ${e?.message || e}`);
    }
  }

  //
  // FILTER HOOKS (run BEFORE Directus actually hits the DB) 🡒 perfect for RLS
  // Docs say filter() runs before the event and you get context.accountability + context.database.  [oai_citation:2‡Directus](https://directus.io/docs/guides/extensions/api-extensions/hooks)
  //

  // This one fires for "list items" requests like GET /items/iglesias?...,
  // payload = query builder object for the collection.
  filter('items.query', async (query, meta, context) => {
    await setRlsContextForRequest(context, meta.collection);
    return query; // must return the payload for filter hooks
  });

  // This one fires for "read single item" requests like GET /items/iglesias/<id>
  // or any direct single fetch.
  filter('items.read', async (payload, meta, context) => {
    await setRlsContextForRequest(context, meta.collection);
    return payload;
  });

  //
  // ACTION HOOK (runs AFTER response is sent back)
  // Docs list `response` as an action with context.database.  [oai_citation:3‡Directus](https://directus.io/docs/guides/extensions/api-extensions/hooks)
  // We use it to RESET so the pooled connection doesn't leak user data.
  //
  action('response', async (_meta, context) => {
    const { database } = context;
    try {
      await database.raw('RESET app.user_id');
      await database.raw('RESET app.is_super_admin');
      await database.raw('RESET app.allowed_iglesias');
    } catch (e) {
      logger?.warn?.(`[rls] RESET failed: ${e?.message || e}`);
    }
  });
};