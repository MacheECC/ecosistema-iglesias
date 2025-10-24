/*export default ({ filter, action }) => {
	filter('items.create', () => {
		console.log('Creating Item!');
	});

	action('items.create', () => {
		console.log('Item created!');
	});
}; */
// export default ({ logger /* action, filter, ... */ }) => {
//  logger.info('RLS HOOK: packaged hook file was loaded');
//}; 
export default ({ logger }) => {
	console.log('RLS HOOK: packaged hook file was loaded')
};