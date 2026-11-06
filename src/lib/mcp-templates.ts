import type { Mcp } from './types';

export type McpTemplateField =
	'description' | 'authentication' | 'instructions' | 'configuration' | 'tools';

export function mcpTemplates({
	name,
	endpoint,
	transport,
	deployment
}: Pick<Mcp, 'endpoint' | 'transport' | 'deployment'> & { name: string }): Record<
	McpTemplateField,
	string
> {
	const serverName = name.trim() || 'my-mcp-server';
	const local = transport === 'stdio';
	const remote = transport === 'http' || transport === 'sse';
	const serverUrl =
		endpoint.trim() ||
		(transport === 'sse' ? 'https://example.org/sse' : 'https://example.org/mcp');
	const setup = `## Prerequisites
- Runtime and version: [required software]
- Network / data access: [VPN, filesystem paths, or services needed]
- Authentication: [how users obtain and configure access, or state that none is required]`;
	const deploymentSteps = `## Deploy the server
1. Obtain the server: [repository, package, or container and version].
2. Install dependencies: [installation commands].
3. Configure the environment: [variable names, settings, and data paths].
4. Start the server: [launch command and working directory].
5. Record the running endpoint: [scheme, hostname, port, and MCP path].`;
	let instructions: string;
	if (local) {
		instructions = `${setup}

## Install and configure
1. Obtain the server: [repository or package and version].
2. Install dependencies: [installation commands].
3. Set the command, arguments, and environment variables in the client configuration below.
4. Use absolute paths where needed. Working directory: [required directory, if any].

## Connect and verify
1. Add the configuration to [MCP client and config-file location].
2. Reload the client. It launches the server process over stdio.
3. Confirm that [expected tool names] appear in the client's tool list.
4. Try [example tool call and expected result].

## Troubleshooting
- Logs: [where to find them]
- Common issues: [missing dependencies, paths, or environment settings]`;
	} else if (remote) {
		const hosting =
			deployment === 'self-hosted' || deployment === 'both'
				? `${deploymentSteps}\n\n`
				: deployment === 'unknown'
					? '## Service availability\n[Explain who hosts this server or how users deploy it.]\n\n'
					: '';
		instructions = `${setup}

${hosting}## Connect to the service
1. Endpoint: ${endpoint.trim() || '[MCP endpoint URL]'}.
2. Transport: ${transport === 'sse' ? 'legacy SSE' : 'Streamable HTTP'}.
3. Add the client configuration below to [MCP client and config-file location].
4. Complete [the client\'s sign-in flow or required authentication setup].
5. Reload the client and confirm that [expected tool names] appear.

## Example usage
[Example tool call, inputs, and expected result]

## Troubleshooting
- Connectivity: [network / VPN requirements and endpoint checks]
- Logs and support: [where to look or whom to contact]`;
	} else {
		instructions = `${setup}

## Connection / deployment
1. Choose the supported transport: [Streamable HTTP, stdio, or legacy SSE].
2. Obtain access or install the server: [service URL or installation steps].
3. Configure your MCP client: [client name, settings, and config-file location].
4. Start or connect to the server: [command or endpoint].

## Verify the connection
[Expected tool names, an example call, and its expected result]

## Troubleshooting
[Common issues, log location, and support contact]`;
	}

	return {
		description: 'An MCP server for [workflow or domain] that lets clients [key capabilities].',
		authentication:
			'[Authentication method, or none]. [How users obtain access and configure their client; include variable names, not credentials].',
		instructions,
		configuration: local
			? JSON.stringify(
					{
						mcpServers: {
							[serverName]: {
								command: '/absolute/path/to/server-command',
								args: [],
								env: { EXAMPLE_SETTING: 'replace-with-required-setting' }
							}
						}
					},
					null,
					2
				)
			: remote
				? JSON.stringify(
						{
							mcpServers: { [serverName]: { type: transport, url: serverUrl } }
						},
						null,
						2
					)
				: '',
		tools: `## [tool_name]
- Purpose: [what this tool does]
- Inputs: [argument names, types, and required / optional values]
- Returns: [output format and meaning]
- Example: [example call and expected result]

## Additional capabilities
- Resources: [available resources, or none]
- Prompts: [available prompts, or none]
- Limits: [supported data, size limits, or other constraints]`
	};
}
