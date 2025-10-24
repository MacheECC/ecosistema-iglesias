// ESM hook entry
export default ({ logger /* action, filter, ... */ }) => {
  logger.info('RLS HOOK: packaged hook file was loaded');
};