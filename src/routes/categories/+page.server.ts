import { taxonomyCounts } from '#lib/server/catalog.ts';
export const load = () => ({ taxonomy: taxonomyCounts() });
