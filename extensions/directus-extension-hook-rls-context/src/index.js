// ================================================================
// HOOK PILOTO DE RLS (FASE 1)
// ---------------------------------------------------------------
// Este hook establece el contexto de RLS (Row Level Security)
// en PostgreSQL/Neon para cada request que llega a Directus.
//
// Objetivo:
//   • Probar el flujo completo de variables de sesión:
//       app.user_id
//       app.is_super_admin
//       app.allowed_iglesias
//   • Activado solo para la colección "iglesias" durante la fase
//     de validación inicial.
//   • Posteriormente se ampliará a todas las tablas multitenant.
// ================================================================

export default ({ action }, { database }) => {
	console.log('RLS PILOTO: hook cargado correctamente');

	// ------------------------------------------------------------
	// Escuchamos todas las acciones. Cada vez que Directus ejecuta
	// una operación (read, create, update, etc.), este hook se dispara.
	// ------------------------------------------------------------
	action('*', async (_payload, { accountability, collection }) => {
		// --------------------------------------------------------
		// 1) Verificar que exista un usuario autenticado.
		// Si no hay usuario (por ejemplo, en endpoints públicos),
		// no hacemos nada y salimos del hook.
		// --------------------------------------------------------
		if (!accountability?.user) return;

		// --------------------------------------------------------
		// 2) Limitamos la ejecución del hook solo a la colección
		// "iglesias" para esta fase piloto. En fases posteriores,
		// se eliminará esta condición para que aplique globalmente.
		// --------------------------------------------------------
		if (collection !== 'iglesias') return;

		// --------------------------------------------------------
		// 3) Capturar los valores básicos de contexto:
		//    - userId: identificador UUID del usuario Directus.
		//    - isSuperAdmin: flag true/false según rol administrativo.
		// --------------------------------------------------------
		const userId = accountability.user; // directus_users.id
		const isSuperAdmin = accountability.admin === true ? 'true' : 'false';

		// --------------------------------------------------------
		// 4) Construir la lista CSV de iglesias permitidas.
		// Buscamos en la tabla `usuarios_iglesias` todas las
		// iglesias asociadas al usuario actual.
		// --------------------------------------------------------
		let allowedCSV = '';
		try {
			const result = await database.raw(
				`
				SELECT array_to_string(array_agg(iglesia_id::text), ',') AS csv
				FROM public.usuarios_iglesias
				WHERE user_id = ?
				`,
				[userId]
			);

			// La estructura depende del cliente PostgreSQL interno.
			// Para compatibilidad, probamos ambos formatos posibles.
			const row =
				(result?.rows && result.rows[0]) ||
				result?.[0] ||
				{ csv: '' };

			allowedCSV = row.csv || '';
		} catch (err) {
			console.warn('[RLS PILOTO] Error obteniendo allowed_iglesias:', err?.message || err);
			allowedCSV = '';
		}

		// --------------------------------------------------------
		// 5) SET de las variables de sesión en Postgres/Neon.
		// Estas variables son leídas por las políticas RLS.
		//
		// Notas:
		//   - Se usa `SET` en lugar de `SET LOCAL` porque Directus
		//     no garantiza transacciones únicas por request.
		//   - Luego se hace `RESET` manual para evitar contaminación
		//     entre usuarios en el pool de conexiones.
		// --------------------------------------------------------
		try {
			await database.raw(`SET app.user_id = ?`, [userId]);
			await database.raw(`SET app.is_super_admin = ?`, [isSuperAdmin]);
			await database.raw(`SET app.allowed_iglesias = ?`, [allowedCSV]);
			console.log(`[RLS PILOTO] Contexto establecido para usuario ${userId}`);
		} catch (err) {
			console.warn('[RLS PILOTO] SET context falló:', err?.message || err);
		}

		// --------------------------------------------------------
		// 6) Cleanup: al finalizar la request, reseteamos todas las
		// variables de sesión para que la conexión del pool quede
		// limpia antes de ser reutilizada por otro usuario.
		// --------------------------------------------------------
		return async () => {
			try {
				await database.raw('RESET app.user_id');
				await database.raw('RESET app.is_super_admin');
				await database.raw('RESET app.allowed_iglesias');
				console.log(`[RLS PILOTO] Contexto limpiado para usuario ${userId}`);
			} catch (err) {
				console.warn('[RLS PILOTO] RESET falló:', err?.message || err);
			}
		};
	});
};