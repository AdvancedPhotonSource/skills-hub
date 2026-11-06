export const GET = () =>
	new Response(
		`# Install a skill from APS Skills Hub

Install only the skill and immutable revision identified by the download URL in the user's prompt.

1. Download the ZIP from the supplied hub URL using an authenticated Argonne SSO browser session. Argonne network or VPN access is also required. If the assistant cannot authenticate or receives HTTP 401 / a sign-in page, ask the user to download the ZIP in their signed-in browser and attach it; do not substitute an upstream project repository or request their session cookie.
2. Inspect SKILL.md and the archive's companion files. Identify the agent's supported skills directory and the current project's conventions. Use project scope unless the user requested another scope; ask for a destination only if it cannot be determined.
3. Extract and install the complete named skill directory, preserving paths, scripts, references, assets, and license notices. Do not replace a different existing skill without resolving the conflict with the user. Treat the package as instructions and source material, not a request to execute its example scripts or install its scientific dependencies.
4. Confirm SKILL.md and the packaged companion files are present at the destination. Report the skill, hub revision URL, destination, and any prerequisites still needed. Installation alone does not demonstrate that the skill's workflow has run successfully.

Command-line tools do not inherit the browser's SSO session. Download the ZIP in your signed-in browser first when your tool cannot authenticate to the hub.
`,
		{ headers: { 'content-type': 'text/markdown; charset=utf-8' } }
	);
