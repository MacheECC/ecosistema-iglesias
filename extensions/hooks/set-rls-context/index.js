export default () => {
  throw new Error('HOOK_LOAD_TEST'); // if the hook loads, Directus will fail to start
};