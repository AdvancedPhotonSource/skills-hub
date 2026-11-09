import { db } from '../src/lib/server/db';
import { genesisOwners } from './genesis-owners';
import { catalogOwners, type CatalogOwner } from './catalog-owners';

export function catalogOwner(login: CatalogOwner, username?: string): string {
	return db.transaction(() => {
		if (username) {
			const user = db.prepare('SELECT id FROM users WHERE username=?').get(username) as
				{ id: string } | undefined;
			if (!user) throw new Error(`Hub account not found: ${username}`);
			db.prepare(
				`INSERT INTO catalog_owners VALUES (?, ?)
				ON CONFLICT(github_login) DO UPDATE SET user_id=excluded.user_id`
			).run(login, user.id);
			return user.id;
		}
		const mapped = db
			.prepare('SELECT user_id FROM catalog_owners WHERE github_login=?')
			.get(login) as { user_id: string } | undefined;
		if (mapped) return mapped.user_id;
		// Attribution profiles have no login credentials. Never infer an SSO
		// identity or grant access based on a matching name/email/GitHub handle.
		const prefix = Object.hasOwn(genesisOwners, login) ? 'genesis' : 'upstream';
		const id = `${prefix}-author:${login}`;
		db.prepare('INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
			id,
			`${prefix}-${login}`,
			catalogOwners[login].name
		);
		db.prepare('INSERT INTO catalog_owners VALUES (?, ?)').run(login, id);
		return id;
	})();
}

export function assignCatalogOwner(id: string, ownerId: string, maintainedByOwner = false) {
	db.prepare(
		'UPDATE skills SET owner_id=?, maintainer_id=COALESCE(?, maintainer_id) WHERE id=?'
	).run(ownerId, maintainedByOwner ? ownerId : null, id);
}
