import { describe, expect, it } from 'vitest';
import { installCommand, installPrompt, packageRunners } from '../src/lib/install';
import { validatePackage } from '../src/lib/server/packages';

describe('installation and repository links', () => {
	it('targets the selected immutable hub package for every runner', () => {
		const url = 'https://hub.anl.gov/skills-hub/skills/123/download?revision=4';
		for (const runner of packageRunners) {
			const command = installCommand(url, 'aps-lauelab-indexing', runner);
			expect(command).toBe(
				`${runner === 'pnpm' ? 'pnpm dlx' : runner} skills@1.7.4 add '${url}' --skill 'aps-lauelab-indexing'`
			);
		}
		expect(
			installPrompt(
				'https://hub.anl.gov/skills-hub/skill-install/prompt.md',
				url,
				'aps-lauelab-indexing'
			)
		).toContain(url);
		expect(installCommand("https://host/it's-a-package?revision=1", 'example', 'npx')).toContain(
			"'https://host/it'\\''s-a-package?revision=1'"
		);
	});
	it('extracts a related project without creating import provenance or accepting unsafe links', () => {
		for (const [url, expected] of [
			[
				'https://github.com/AdvancedPhotonSource/lauelab/',
				'https://github.com/AdvancedPhotonSource/lauelab'
			],
			['javascript:alert(1)', null],
			['https://github.com.evil.example/owner/repo', null],
			['https://user:secret@github.com/owner/repo', null],
			['https://github.com/owner/repo?token=secret', null]
		]) {
			const pkg = validatePackage([
				{
					path: 'SKILL.md',
					data: Buffer.from(
						`---\nname: local-skill\ndescription: A local contribution\nmetadata:\n  source-repository: ${JSON.stringify(url)}\n---\n# Local skill\n`
					),
					mode: 0o644
				}
			]);
			expect(pkg.projectRepository).toBe(expected);
			expect(pkg.source).toBeUndefined();
		}
	});
});
