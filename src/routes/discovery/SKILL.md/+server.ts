import source from '../../../../skills/aps-hub-discovery/SKILL.md?raw';

export const GET = () =>
	new Response(source, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
