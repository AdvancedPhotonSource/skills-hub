import source from '../../../../skills/aps-hub-discovery/SKILL.md?raw';
import { zipSync } from 'fflate';

export const GET = () =>
	new Response(zipSync({ 'aps-hub-discovery/SKILL.md': new TextEncoder().encode(source) }), {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': 'attachment; filename="aps-hub-discovery.zip"'
		}
	});
