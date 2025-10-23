// If this loads, Directus must fail to start (binary proof the loader sees it)
module.exports = () => { throw new Error('HOOK_LOAD_TEST'); };