export default ({ init }) => {
  console.log('RLS HOOK: filesystem hook file was loaded');
  init('server.start', () => console.log('RLS HOOK: server.start observed'));
};