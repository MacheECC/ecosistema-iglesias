// index.js
export default ({ init, logger }) => {
  logger.info('RLS HOOK: filesystem hook file was loaded');
  init('server.start', () => {
    logger.info('RLS HOOK: server.start observed');
  });
};