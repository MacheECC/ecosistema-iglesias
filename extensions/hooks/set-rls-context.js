import { defineHook } from 'directus/extensions';

async function setRLSContext(db, accountability) {
  const userId = accountability?.user || '';
  const isAdmin = !!accountability?.admin;

  await db.raw('SET LOCAL app.user_id = ?', [userId]);
  await db.raw('SET LOCAL app.is_super_admin = ?', [isAdmin ? 'true' : 'false']);

  let allowedCSV = '';
  if (userId) {
    const rows = await db.raw(
      `SELECT array_to_string(array_agg(iglesia_id::text), ',') AS csv
         FROM public.usuarios_iglesias
        WHERE user_id = ?`,
      [userId]
    );
    const rec = (rows?.rows && rows.rows[0]) || rows?.[0] || {};
    allowedCSV = rec?.csv || '';
  }

  await db.raw('SET LOCAL app.allowed_iglesias = ?', [allowedCSV]);
}

export default defineHook(({ filter }, { database }) => {
  const events = ['items.read', 'items.query', 'items.create', 'items.update', 'items.delete'];
  for (const ev of events) {
    filter(ev, async (input, meta) => {
      await setRLSContext(database, meta.accountability);
      return input;
    });
  }
});