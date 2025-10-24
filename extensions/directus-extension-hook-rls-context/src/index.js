/* export default ({ logger }) => {
	console.log('RLS HOOK: packaged hook file was loaded')
}; */
import { defineHook } from 'directus/extensions';

export default defineHook(({ action }, { database }) => {
	console.log('RLS HOOK: packaged hook file was loaded');

action('*', async (_payload, { accountability }) => {
// 1) identity
const userId = accountability?.user || '';
const isAdmin = !!accountability?.admin;
// 2) compute allowed iglesias via self-lookup (safe, non-recursive)
let allowedCSV = '';
try {
  if (userId) {
    const rows = await database.raw(
      `SELECT array_to_string(array_agg(iglesia_id::text), ',') AS csv
         FROM public.usuarios_iglesias
        WHERE user_id = ?`,
      [userId]
    );
    const rec = (rows?.rows && rows.rows[0]) || rows?.[0] || {};
    allowedCSV = rec?.csv || '';
  }
} catch {
  // leave allowedCSV empty if lookup fails
  allowedCSV = '';
}

// 3) set GUCs for this request at SESSION scope
// (not LOCAL) so they exist when Directus performs the DB work
try {
  await database.raw('SET app.user_id = ?', [userId]);
  await database.raw('SET app.is_super_admin = ?', [isAdmin ? 'true' : 'false']);
  await database.raw('SET app.allowed_iglesias = ?', [allowedCSV]);
} catch (err) {
  // If SET fails, log minimal info and continue (request will see zero rows)
  console.warn('[set-rls-context] SET failed:', err?.message || err);
}

// 4) very important: reset after Directus finishes the request,
// so pooled connections don’t leak values between users.
return async () => {
  try {
    await database.raw('RESET app.user_id');
    await database.raw('RESET app.is_super_admin');
    await database.raw('RESET app.allowed_iglesias');
  } catch (err) {
    console.warn('[set-rls-context] RESET failed:', err?.message || err);
  }
};
});
});