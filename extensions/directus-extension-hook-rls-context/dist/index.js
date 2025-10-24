// extensions/directus-extension-hook-rls-context/dist/index.js (ESM)
export default ({ logger /*, action, filter, init, schedule */ }) => {
  logger.info('RLS HOOK: packaged hook file was loaded');
  // register your actions/filters here, e.g.:
  // action('items.read', async (meta, ctx) => { ... });
};