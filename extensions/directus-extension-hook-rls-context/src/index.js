// ================================================================
// HOOK RLS (STUB / INACTIVO)
// ---------------------------------------------------------------
// Este archivo existe sólo para mantener la estructura de extensiones
// en Directus. Ya NO seteamos contexto RLS, ni tocamos variables
// de sesión en Postgres, ni hacemos RESET.
//
// Queda listo para que en el futuro puedas volver a agregar lógica
// controladamente sin re-crear toda la extensión.
// ================================================================

export default ({ action }, { database }) => {
	console.log('RLS STUB: hook cargado (sin lógica activa)');

	// Registramos un listener global que no hace nada.
	action('*', async (_payload, _meta) => {
		// No hacemos nada en este momento.
		// Devolvemos sin modificar contexto, sin tocar la base.
		return;
	});
};