import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { catalogOwner } from './catalog-owner';
import { refineCatalog } from './catalog-maintenance';
import { catalogOwners, type CatalogOwner } from './catalog-owners';

try {
	const [username, ...mappings] = process.argv.slice(2);
	if (!username)
		throw new Error(
			'Usage: npm run refine:catalog -- <admin username> [github-login=hub-username ...]'
		);
	const row = db.prepare('SELECT id FROM users WHERE username=?').get(username) as
		{ id: string } | undefined;
	const admin = row && userById(row.id);
	if (!admin?.isAdmin) throw new Error('Specify an existing Hub administrator.');
	db.transaction(() => {
		for (const mapping of mappings) {
			const [login, account, extra] = mapping.split('=');
			if (!Object.hasOwn(catalogOwners, login) || !account || extra !== undefined)
				throw new Error(`Invalid owner mapping: ${mapping}`);
			catalogOwner(login as CatalogOwner, account);
		}
	})();
	console.log(refineCatalog(admin));
} finally {
	db.close();
}
