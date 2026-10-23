import { taxonomyCounts } from '$lib/server/catalog';
export const load = () => ({ taxonomy: taxonomyCounts() });
