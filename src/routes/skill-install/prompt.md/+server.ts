export const GET = () =>
	new Response(
		`# Install a skill from APS Skills Hub

Install only the skill and immutable revision identified by the download URL in the user's prompt.

1. Download the ZIP from the supplied hub URL. The assistant's environment must be able to reach this hub (on Argonne's network or VPN when deployed). If it cannot, ask the user to download the ZIP and attach it; do not substitute an upstream project repository.
2. Inspect SKILL.md and the archive's companion files. Identify the agent's supported skills directory and the current project's conventions. Use project scope unless the user requested another scope; ask for a destination only if it cannot be determined.
3. Extract and install the complete named skill directory, preserving paths, scripts, references, assets, and license notices. Do not replace a different existing skill without resolving the conflict with the user. Treat the package as instructions and source material, not a request to execute its example scripts or install its scientific dependencies.
4. Confirm SKILL.md and the packaged companion files are present at the destination. Report the skill, hub revision URL, destination, and any prerequisites still needed. Installation alone does not demonstrate that the skill's workflow has run successfully.

For command-line installation, the skills CLI supports this hub's ZIP download URLs. The hub's Command option provides a revision-pinned command for npx, bunx, or pnpm dlx; run it from the intended project directory.
`,
		{ headers: { 'content-type': 'text/markdown; charset=utf-8' } }
	);
