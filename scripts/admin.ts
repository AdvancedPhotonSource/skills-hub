import { randomBytes } from 'node:crypto';
import { db } from '../src/lib/server/db';
import { resetPassword } from '../src/lib/server/auth';

const [command, username] = process.argv.slice(2);
if (!username || !['promote', 'demote', 'reset'].includes(command)) {
	console.error('Usage: npm run admin -- <promote|demote|reset> <username>');
	process.exitCode = 1;
} else {
	const user = db.prepare('SELECT id FROM users WHERE username=?').get(username) as
		{ id: string } | undefined;
	if (!user) {
		console.error('Account not found.');
		process.exitCode = 1;
	} else if (command === 'reset') {
		const password = randomBytes(18).toString('base64url');
		await resetPassword(user.id, password);
		console.log(
			`Sessions revoked. Deliver this temporary password privately and ask the user to change it:\n${password}`
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
