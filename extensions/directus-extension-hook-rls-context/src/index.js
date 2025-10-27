// ================================================================
// HOOK RLS (FASE 1.2 - CONTEXTO GLOBAL CON SET CORREGIDO)
// ---------------------------------------------------------------
// Este hook inyecta el contexto RLS para cada request autenticada,
// seteando variables de sesión a nivel de conexión Postgres/Neon:
//
//   app.user_id
//   app.is_super_admin
//   app.allowed_iglesias
//
// Problema detectado en la versión anterior:
//   - `database.raw('SET app.user_id = ?', [userId])` no funcionó
//     porque Postgres recibió literalmente "$1".
//   - Eso evitó que las variables se establezcan, y como resultado
//     el super admin no pudo ver nada.
//
// Solución en esta versión:
//   - Construimos las sentencias SET como strings literales ya
//     interpoladas, escapando comillas simples manualmente.
//   - Mantenemos el RESET al final para limpiar el pool.
//
// Nota: aún no seteamos app.persona_id aquí. Eso vendrá cuando
// activemos RLS en `personas`.
// ================================================================

export default ({ action }, { database }) => {
	console.log('RLS: hook cargado (contexto global con SET corregido)');

	action('*', async (_payload, { accountability }) => {
		// --------------------------------------------------------
		// 1) Si no hay usuario autenticado, no seteamos nada.
		//    Esto evita errores en requests anónimas.
		// --------------------------------------------------------
		if (!accountability?.user) return;

		// --------------------------------------------------------
		// 2) Extraemos:
		//    - userId: UUID del usuario Directus
		//    - isSuperAdmin: 'true' / 'false'
		//    - allowedCSV: lista CSV de iglesia_id a las que
		//      pertenece este usuario, sacadas de public.usuarios_iglesias
		// --------------------------------------------------------
		const userId = accountability.user;
		const isSuperAdmin = accountability.admin === true ? 'true' : 'false';

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

			const row =
				(result?.rows && result.rows[0]) ||
				result?.[0] ||
				{ csv: '' };

			allowedCSV = row.csv || '';
		} catch (err) {
			console.warn('[RLS] Error obteniendo allowed_iglesias:', err?.message || err);
			allowedCSV = '';
		}

		// --------------------------------------------------------
		// 3) Pequeña función utilitaria para escapar comillas simples
		//    en los valores que enviaremos en SET '...'.
		//    Reemplaza cada ' por '' como requiere SQL.
		// --------------------------------------------------------
		function sqlLiteral(str) {
			if (str === null || str === undefined) return '';
			return String(str).replace(/'/g, "''");
		}

		// --------------------------------------------------------
		// 4) Seteamos las variables de sesión en Postgres.
		//    IMPORTANTE:
		//    - Aquí NO usamos parámetros "?" porque en tu entorno
		//      knex+pg no está parametrizando bien los SET.
		//    - En su lugar, interpolamos el valor ya escapado.
		//
		//    Ejemplo final que verá Postgres:
		//      SET app.user_id = '9a955fe2-...';
		//      SET app.is_super_admin = 'true';
		//      SET app.allowed_iglesias = 'uuid1,uuid2,...';
		//
		//    Esto hará que las functions app_is_super_admin()
		//    y app_iglesias_permitidas() devuelvan valores
		//    correctos durante la evaluación RLS.
		// --------------------------------------------------------
		try {
			await database.raw(
				`SET app.user_id = '${sqlLiteral(userId)}'`
			);

			await database.raw(
				`SET app.is_super_admin = '${sqlLiteral(isSuperAdmin)}'`
			);

			await database.raw(
				`SET app.allowed_iglesias = '${sqlLiteral(allowedCSV)}'`
			);

			console.log('[RLS] Contexto establecido:', {
				user_id: userId,
				is_super_admin: isSuperAdmin,
				allowed_iglesias: allowedCSV,
			});
		} catch (err) {
			console.warn('[RLS] SET context falló incluso tras interpolar:', err?.message || err);
		}

		// --------------------------------------------------------
		// 5) Cleanup al final de la request:
		//    Resetear las variables para que la conexión del pool
		//    no herede el contexto de este usuario.
		//
		//    Si esto falla, podríamos tener "fugas" de permisos,
		//    así que dejamos log de advertencia.
		// --------------------------------------------------------
		return async () => {
			try {
				await database.raw('RESET app.user_id');
				await database.raw('RESET app.is_super_admin');
				await database.raw('RESET app.allowed_iglesias');

				console.log('[RLS] Contexto limpiado:', {
					user_id: userId,
					is_super_admin: isSuperAdmin,
					allowed_iglesias: allowedCSV,
				});
			} catch (err) {
				console.warn('[RLS] RESET falló:', err?.message || err);
			}
		};
	});
};