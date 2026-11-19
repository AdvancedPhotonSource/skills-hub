import { json } from '@sveltejs/kit';
import { registerClient } from '#lib/server/oauth.ts';
import { allowAttempt } from '#lib/server/auth.ts';
import { HubError } from '#lib/server/errors.ts';

// RFC 7591 dynamic client registration. Registering a client grants nothing on
// its own: it cannot read anything until a signed-in user approves it at
// /oauth/authorize, so this stays open, rate limited per address.
export const POST = async ({ request, getClientAddress }: import('./$types').RequestEvent) => {
	if (!allowAttempt(`register:${getClientAddress()}`, 20))
		return json({ error: 'temporarily_unavailable' }, { status: 429 });
	let metadata: Record<string, unknown>;
	try {
		metadata = await request.json();
	} catch {
		return json({ error: 'invalid_client_metadata' }, { status: 400 });
	}
	try {
		return json(registerClient(metadata), { status: 201 });
	} catch (error) {
		return json(
			{
				error: 'invalid_redirect_uri',
				error_description: error instanceof HubError ? error.message : 'Registration failed.'
			},
			{ status: 400 }
		);
	}
};
