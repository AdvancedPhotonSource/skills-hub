import { json } from '@sveltejs/kit';
import { taxonomyCounts } from '#lib/server/catalog.ts';
export const GET = () => json({ categories: taxonomyCounts() });
