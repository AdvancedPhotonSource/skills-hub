import { randomBytes } from 'node:crypto';
import { db } from '../src/lib/server/db';
import { resetPassword } from '../src/lib/server/auth';
import { entraIdentity, linkEntraIdentity } from '../src/lib/server/entra';

const [command, username, objectId] = process.argv.slice(2);
if (
	!username ||
	!['promote', 'demote', 'reset', 'verify', 'unverify', 'link-entra', 'identity'].includes(command)
) {
	console.error(
		'Usage: npm run admin -- <promote|demote|reset|verify|unverify|identity> <username>\n       npm run admin -- link-entra <username> <Entra-object-ID>'
	);
	process.exitCode = 1;
} else {
	const user = db.prepare('SELECT id FROM users WHERE username=?').get(username) as
		{ id: string } | undefined;
	if (!user) {
		console.error('Account not found.');
		process.exitCode = 1;
	} else if (command === 'link-entra') {
		try {
			linkEntraIdentity(user.id, objectId || '');
			console.log(
				`${username}: Argonne identity linked. Existing ownership and permissions preserved.`
			);
		} catch (error) {
			console.error(error instanceof Error ? error.message : 'Unable to link identity.');
			process.exitCode = 1;
		}
	} else if (command === 'identity') {
		const identity = entraIdentity(user.id);
		console.log(
			identity
				? JSON.stringify({ hubUsername: username, ...identity }, null, 2)
				: 'No Argonne identity linked.'
		);
	} else if (command === 'reset') {
		const password = randomBytes(18).toString('base64url');
		await resetPassword(user.id, password);
		console.log(
			`Sessions revoked. Deliver this temporary password privately and ask the user to change it:\n${password}`
		);
	} else if (command === 'verify' || command === 'unverify') {
		db.prepare('UPDATE users SET verified=? WHERE id=?').run(Number(command === 'verify'), user.id);
		console.log(
			`${username}: ${command === 'verify' ? 'verified for publishing' : 'publishing verification removed'}.`
		);
	} else {
		db.prepare('UPDATE users SET is_admin=? WHERE id=?').run(
			Number(command === 'promote'),
			user.id
		);
		console.log(
			`Administrator access ${command === 'promote' ? 'granted to' : 'removed from'} ${username}.`
		);
	}
}
db.close();
