// Minimal, foldered local hook. No SDK import required.
export default ({ filter, action }, { database }) => {
  console.info('[rls-hook] loaded');

  const setContext = async (accountability) => {
    const userId = accountability?.user || '';
    const isAdmin = !!accountability?.admin;

    // Build allowed churches from usuarios_iglesias (non-recursive)
    let allowedCSV = '';
    if (userId) {
      try {
        const rows = await database.raw(
          `SELECT array_to_string(array_agg(iglesia_id::text), ',') AS csv
             FROM public.usuarios_iglesias
            WHERE user_id = ?`,
          [userId]
        );
        const rec = (rows?.rows && rows.rows[0]) || rows?.[0] || {};
        allowedCSV = rec?.csv || '';
      } catch {
        allowedCSV = '';
      }
    }

    // Session-scope SET (survives the DB operation); we RESET after
    await database.raw('SET app.user_id = ?', [userId]);
    await database.raw('SET app.is_super_admin = ?', [isAdmin ? 'true' : 'false']);
    await database.raw('SET app.allowed_iglesias = ?', [allowedCSV]);
  };

  const resetContext = async () => {
    try {
      await database.raw('RESET app.user_id');
      await database.raw('RESET app.is_super_admin');
      await database.raw('RESET app.allowed_iglesias');
    } catch { /* ignore */ }
  };

  const events = ['items.read','items.query','items.create','items.update','items.delete'];

  for (const ev of events) {
    filter(ev, async (payload, meta) => {
      await setContext(meta.accountability);
      return payload;
    });
    action(ev, async () => {
      await resetContext();
    });
  }
};