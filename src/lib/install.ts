export const packageRunners = ['npx', 'bunx', 'pnpm'] as const;
export type PackageRunner = (typeof packageRunners)[number];
export const installerVersion = '1.7.4';
const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

export function installCommand(downloadUrl: string, name: string, runner: PackageRunner) {
	const prefix = runner === 'pnpm' ? 'pnpm dlx' : runner;
	return `${prefix} skills@${installerVersion} add ${quote(downloadUrl)} --skill ${quote(name)}`;
}

export function installPrompt(guideUrl: string, downloadUrl: string, name: string) {
	return `Follow ${guideUrl} to install only the Agent Skill "${name}" from ${downloadUrl}. Keep SKILL.md and all companion files together.`;
}
