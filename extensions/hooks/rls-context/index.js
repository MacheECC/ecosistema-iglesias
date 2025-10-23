// Will print once on boot if this file is picked up
console.info('RLS HOOK: filesystem hook file was loaded');

export default ({ action, logger }) => {
  logger.info('RLS HOOK: hook registered');

  // Example: log whenever /items/* is read
  action('items.read', (input, meta, ctx) => {
    logger.info(`RLS HOOK: items.read on ${meta.collection}`);
    return input; // don’t block
  });
};