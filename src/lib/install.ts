export const packageRunners = ['npx', 'bunx', 'pnpm'] as const;
export type PackageRunner = (typeof packageRunners)[number];
export const installerVersion = '1.7.4';
const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

export function installCommand(downloadUrl: string, name: string, runner: PackageRunner) {
	const prefix = runner === 'pnpm' ? 'pnpm dlx' : runner;
	return `${prefix} skills@${installerVersion} add ${quote(downloadUrl)} --skill ${quote(name)}`;
}

export function installPrompt(downloadUrl: string, name: string, minutes: number) {
	return [
		`Install the Agent Skill "${name}" from the APS Skills Hub.`,
		'',
		`1. Download the ZIP from ${downloadUrl}`,
		`   The link needs no sign-in and expires in ${minutes} minutes. If it has expired, ask me for a fresh link from the hub rather than substituting another source.`,
		`2. Extract the "${name}" directory into this project's agent skills directory, keeping SKILL.md and every companion file, script, reference and licence notice together.`,
		'3. Treat the package as instructions and reference material. Do not run its example scripts or install its scientific dependencies as part of installing it.',
		'4. Report the skill name, revision and destination when you are done.'
	].join('\n');
}
