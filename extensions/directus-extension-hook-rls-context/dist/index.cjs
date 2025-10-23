module.exports = defineHook(({ init }) => {
  init('app.before', () => {
    console.log('HOOK_LOAD_TEST');
  });
});