import { json } from '@sveltejs/kit';
import { taxonomyCounts } from '$lib/server/catalog';
export const GET = () => json({ categories: taxonomyCounts() });
