import { fail } from '@sveltejs/kit';
import { HubError } from './errors';

export function formError(error: unknown) {
	if (error instanceof HubError) return fail(error.status, { message: error.message });
	console.error(error);
	return fail(500, { message: 'Something went wrong. Please try again.' });
}
