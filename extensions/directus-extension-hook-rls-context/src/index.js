export default ({ filter, action }, { logger }) => {
  logger?.info?.('[rls] hook loaded');

  // UUID nulo seguro para evitar cadenas vacías
  const NULL_UUID = '00000000-0000-0000-0000-000000000000';

  async function computeAllowedCSV(database, userId) {
    /*
      Devuelve un CSV de iglesias permitidas para este usuario.
      Si el usuario no tiene ninguna, devolvemos NULL_UUID,
      para que las políticas RLS siempre reciban algo casteable.
    */
    if (!userId) return NULL_UUID;

    try {
      const rows = await database.raw(
        `
        SELECT array_to_string(array_agg(iglesia_id::text), ',') AS csv
        FROM public.usuarios_iglesias
        WHERE user_id = ?
        `,
        [userId]
      );

      // knex/pg puede devolver { rows: [...] } o [ ... ] según versión
      const rec = (rows?.rows && rows.rows[0]) || rows?.[0] || {};
      const csv = rec?.csv;

      return csv && csv.trim() !== '' ? csv : NULL_UUID;
    } catch (e) {
      logger?.warn?.(`[rls] allowed iglesias lookup failed: ${e?.message || e}`);
      return NULL_UUID;
    }
  }

  async function primeConnection({ accountability, database }, sourceTag) {
    /*
      Escribe las variables de sesión (GUCs) en ESTA conexión.
      - app.user_id
      - app.is_super_admin
      - app.allowed_iglesias

      IMPORTANTE: Nunca escribimos cadenas vacías ("").
      Siempre escribimos valores casteables.
    */

    const userId = accountability?.user || '';
    const isAdmin = !!accountability?.admin;

    const effectiveUserId = userId || NULL_UUID;
    const allowedCSV = await computeAllowedCSV(database, userId);

    try {
      await database.raw(`SELECT set_config('app.user_id', ?, false)`, [
        effectiveUserId,
      ]);

      await database.raw(`SELECT set_config('app.is_super_admin', ?, false)`, [
        isAdmin ? 'true' : 'false',
      ]);

      await database.raw(`SELECT set_config('app.allowed_iglesias', ?, false)`, [
        allowedCSV,
      ]);
    } catch (e) {
      logger?.warn?.(
        `[rls] set_config failed [${sourceTag}]: ${e?.message || e}`
      );
    }

    // DEBUG opcional: leer de vuelta
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
        msg: `[rls] context after set_config (${sourceTag})`,
        check: check?.rows?.[0],
        req_user: userId || '(none)',
      });
    } catch (e) {
      logger?.warn?.(`[rls] verify failed [${sourceTag}]: ${e?.message || e}`);
    }
  }

  /* =========================================================
     CAPA GLOBAL (authenticate)
     ---------------------------------------------------------
     Se ejecuta temprano en el ciclo de request. Cubre:
     - vistas de archivos,
     - agregaciones,
     - llamadas internas de Directus que NO pasan por items.query.
  */
  filter('authenticate', async (payload, meta, context) => {
    await primeConnection(context, 'authenticate');
    return payload; // los filtros SIEMPRE devuelven su payload
  });

  /* =========================================================
     CAPA POR COLECCIÓN (items.query / items.read)
     ---------------------------------------------------------
     Se ejecuta justo antes de que Directus haga SELECTs reales
     contra una collection. Esto garantiza que si Directus
     abre otra conexión del pool, también la prime.
  */
  filter('items.query', async (query, meta, context) => {
    await primeConnection(context, `items.query:${meta.collection}`);
    return query;
  });

  filter('items.read', async (payload, meta, context) => {
    await primeConnection(context, `items.read:${meta.collection}`);
    return payload;
  });

  /* =========================================================
     LIMPIEZA (response)
     ---------------------------------------------------------
     Después de enviar la respuesta HTTP, reseteamos las GUCs
     para que la conexión vuelva limpia al pool.
  */
  action('response', async (_payload, context) => {
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