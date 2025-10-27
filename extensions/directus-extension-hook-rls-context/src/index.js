// ================================================================
// HOOK RLS (FASE 1.1 - CONTEXTO GLOBAL)
// ---------------------------------------------------------------
// Este hook establece el contexto de RLS (Row Level Security)
// en PostgreSQL/Neon para cada request autenticada que llega
// a Directus.
//
// Diferencias contra la versión piloto anterior:
//   - Antes: solo aplicaba si collection === 'iglesias'.
//   - Ahora: aplica SIEMPRE que haya usuario autenticado,
//     sin importar la colección, porque Directus a veces hace
//     consultas internas (counts, agregates, lookups de archivos)
//     que no etiquetan correctamente la colección.
//
// Este cambio es necesario para que el super admin pueda ver
// contenido sin quedarse "ciego" por falta de contexto.
// ================================================================

export default ({ action }, { database }) => {
	console.log('RLS: hook cargado (contexto global activado)');

	// ------------------------------------------------------------
	// Escuchamos todas las acciones. Cada vez que Directus ejecuta
	// una operación (read, create, update, delete, aggregate, etc.),
	// este hook se dispara.
	//
	// Nota importante:
	//  - Este hook corre ANTES de que Directus ejecute la(s) query(s)
	//    reales contra la base.
	//  - Lo que hacemos aquí es "inyectar identidad" en la conexión.
	// ------------------------------------------------------------
	action('*', async (_payload, { accountability /*, collection */ }) => {
		// --------------------------------------------------------
		// 1) Verificar que exista un usuario autenticado.
		// Si no hay usuario (por ejemplo, endpoints públicos,
		// assets públicos, etc.), no seteamos contexto.
		//
		// Esto evita forzar casts con valores vacíos tipo ''::uuid
		// en las policies.
		// --------------------------------------------------------
		if (!accountability?.user) return;

		// --------------------------------------------------------
		// 2) Capturar los valores básicos de contexto:
		//
		//    - userId:
		//        UUID del usuario Directus actual (directus_users.id).
		//        Lo usamos para depuración y para posibles políticas
		//        que necesiten saber "yo soy este usuario".
		//
		//    - isSuperAdmin:
		//        'true' si este usuario es admin global de Directus.
		//        Esto se convierte en bypass total dentro de las
		//        policies usando app_is_super_admin().
		//
		//    - allowedCSV:
		//        Lista CSV de iglesia_id (UUIDs) a las que este
		//        usuario pertenece, según la tabla public.usuarios_iglesias.
		//        Esta lista gobierna qué filas puede ver/modificar.
		// --------------------------------------------------------
		const userId = accountability.user; // directus_users.id
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

			// El cliente knex/pg puede devolver .rows[0] (pg nativo)
			// o [0] (sqlite style, pero no aplica aquí).
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
		// 3) SET de las variables de sesión en Postgres/Neon.
		//
		// Estas variables serán leídas dentro de las policies RLS:
		//   - app.user_id
		//   - app.is_super_admin
		//   - app.allowed_iglesias
		//
		// Nota técnica:
		//   - No usamos SET LOCAL porque Directus no garantiza
	//     que cada request viva en una única transacción BEGIN..COMMIT.
		//
		//   - En su lugar hacemos SET "normal" y luego hacemos
		//     RESET manual cuando la request termina (cleanup).
		//
		//   - Esto es crítico para evitar fugas de contexto entre
		//     conexiones reutilizadas del pool (usuario A heredando
		//     permisos de usuario B o del super admin).
		// --------------------------------------------------------
		try {
			await database.raw(`SET app.user_id = ?`, [userId]);
			await database.raw(`SET app.is_super_admin = ?`, [isSuperAdmin]);
			await database.raw(`SET app.allowed_iglesias = ?`, [allowedCSV]);

			console.log(
				'[RLS] Contexto establecido:',
				{
					user_id: userId,
					is_super_admin: isSuperAdmin,
					allowed_iglesias: allowedCSV,
				}
			);
		} catch (err) {
			console.warn('[RLS] SET context falló:', err?.message || err);
		}

		// --------------------------------------------------------
		// 4) Cleanup final.
		//
		// Directus permite que este hook retorne una función async.
		// Esa función se ejecuta al final de la request.
		//
		// Aquí hacemos RESET de todas las variables de sesión
		// que seteamos arriba, para que la conexión del pool
		// vuelva limpia y no contamine al siguiente usuario.
		// --------------------------------------------------------
		return async () => {
			try {
				await database.raw('RESET app.user_id');
				await database.raw('RESET app.is_super_admin');
				await database.raw('RESET app.allowed_iglesias');

				console.log(
					'[RLS] Contexto limpiado:',
					{
						user_id: userId,
						is_super_admin: isSuperAdmin,
						allowed_iglesias: allowedCSV,
					}
				);
			} catch (err) {
				console.warn('[RLS] RESET falló:', err?.message || err);
			}
		};
	});
};