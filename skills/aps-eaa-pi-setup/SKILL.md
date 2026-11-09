---
name: aps-eaa-pi-setup
description: Install, configure, or troubleshoot EAA-Pi on Linux for APS experimental workflows. Set up a shared terminal/web workspace, Argo or OpenAI-compatible providers, existing MCP connections, and downloaded skills; diagnose missing models, tools, skills, or runtime dependencies.
compatibility: Linux, Node.js 22.19+, npm, uv, Git, Bash, curl, tar, and sha256sum. Requires a configured model service for model-backed use. Reviewed against EAA-Pi commit 27fa4514def06d143a3fac3ea5944349f25d2ece.
metadata:
  version: '1.0.0'
  author: Samuel Haskel
  source-repository: https://github.com/AdvancedPhotonSource/EAA-Pi
  source-commit: 27fa4514def06d143a3fac3ea5944349f25d2ece
---

# Set up an EAA-Pi workspace

Use this skill for EAA-Pi, the terminal and web assistant built on pi-experiment-ops. It is a client of MCP servers. This hub-authored guide covers application installation and integration; the initialized workspace's bundled `workspace-setup` skill handles in-agent workspace configuration.

[Reviewed sources and configuration reference](references/setup.md)

## Establish the environment

1. Identify the Linux host, installed EAA-Pi version or source commit, installation directory, and workspace directory. Check `node --version`, `npm --version`, and `uv --version`. Use the documentation matching the installed version if it differs from this snapshot.
2. Obtain the actual provider/model identifiers and required authentication, the MCP transport and endpoint or launch command, and any skill folders to install. For Argo, use the user's Argonne username and a model available to that account.
3. Inspect existing workspace settings before editing. EAA-Pi and pi-experiment-ops share `.pi-experiment-ops/agent` and `.pi/mcp.json`; the older Python EAA runtime uses different APIs and configuration.

## Install when needed

For an existing working installation, proceed to workspace setup. For a fresh source installation, choose a new application directory and use the reviewed revision:

```sh
git clone https://github.com/AdvancedPhotonSource/EAA-Pi.git
cd EAA-Pi
git checkout 27fa4514def06d143a3fac3ea5944349f25d2ece
bash scripts/install.sh --runtime-only
```

The installer installs the dependency graph, provisions the bundled Python runtime through pi-experiment-ops, and builds EAA-Pi. Python is managed separately from the system interpreter.

Use the resulting absolute `/path/to/EAA-Pi/bin/eaa-pi.mjs` launcher, or expose it on PATH from the checkout:

```sh
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/eaa-pi.mjs" "$HOME/.local/bin/eaa-pi"
export PATH="$HOME/.local/bin:$PATH"
```

Inspect an existing `eaa-pi` launcher before creating that link. For an upstream release installation, follow the pinned [installation guide](https://github.com/AdvancedPhotonSource/EAA-Pi/blob/27fa4514def06d143a3fac3ea5944349f25d2ece/docs/installation.md); its release command requires the matching published tag and tarball/checksum assets.

## Initialize and configure

Use the chosen workspace consistently; replace the example path as needed:

```sh
eaa-pi init --workspace ~/eaa-workspace
eaa-pi config --workspace ~/eaa-workspace
```

Initialization preserves existing configuration and supplies the bundled `workspace-setup` skill. Guided setup configures an Argo or OpenAI-compatible provider, model defaults, and web port, and optionally offers MCP and skill setup. Use real model IDs rather than guessing them. Where setup requests an API-key environment-variable name, supply the name and set its value in the launching terminal.

Provider/model defaults belong in `.pi-experiment-ops/agent/settings.json`; custom providers live in `models.json` and credentials in `auth.json` in that directory. `eaa-pi.json` holds the web host and port. Preserve unrelated fields when changing JSON. Stop EAA-Pi before configuration changes, and restart afterward.

## Connect an existing MCP server

```sh
eaa-pi config add-mcp --workspace ~/eaa-workspace
```

Choose `http` for Streamable HTTP, `sse` for an older web server, or `stdio` for a locally launched program. Supply the actual service URL or command. Enter stdio arguments one at a time without shell quoting; confirm the executable and working directory on this host. HTTP connections can use bearer-token or OAuth authentication and additional headers. Header and environment values may refer to terminal variables as `$env:NAME`.

The command saves `.pi/mcp.json` and preserves existing servers. It does not launch or test the connection. Restart EAA-Pi to connect, inspect its tool viewer and Logs pane, and use the idle-state reconnect control for a configured server. If OAuth is requested, complete the TUI's `/mcp-auth SERVER_NAME` flow. An advertised tool list confirms discovery, not successful execution of every tool.

## Add a downloaded skill

Extract the complete skill folder, preserving `SKILL.md`, references, scripts, and assets, then run:

```sh
eaa-pi config add-skill /absolute/path/to/skill-folder --workspace ~/eaa-workspace
```

The default copies the complete folder into `.pi/skills`; `--link` links it instead and requires the source folder to remain available. Existing destinations are kept, so inspect them before attempting an update. Restart EAA-Pi after adding a skill and invoke `/skill:name`, using the frontmatter name. For automatic discovery, check `defaultPolicy.skills` in `.pi-experiment-ops/agent/pi-permissions.jsonc`; new workspaces set it to `"allow"`, while existing files retain their settings.

## Validate and launch

```sh
eaa-pi doctor --workspace ~/eaa-workspace
eaa-pi pi --workspace ~/eaa-workspace
```

`doctor` checks the Node version, compiled frontend, extension resources, Python imports, and Pi CLI. Start the TUI and try a simple model-backed question about the workspace. Close it before launching the web interface for the same workspace:

```sh
eaa-pi serve --workspace ~/eaa-workspace
```

Open the printed address (normally `http://127.0.0.1:8010`) on the same host. The interfaces share settings and conversations; run one interface at a time for the workspace. Keep the server terminal running; Ctrl+C stops it.

## Troubleshoot and hand off

- **Command missing:** inspect the launcher target and PATH, or use the absolute packaged launcher.
- **Python imports or runtime missing:** rerun the matching installer and `doctor`; inspect `PI_OPS_PYTHON` if explicitly overridden.
- **Empty model list or rejected request:** confirm the selected workspace, exact provider/model IDs, authentication, and launching environment. A running WebUI alone does not validate a provider.
- **Missing MCP tools:** inspect `.pi/mcp.json`, transport, command/URL, authentication, and connection logs; restart after changing configuration.
- **Missing skill:** confirm `.pi/skills/<folder>/SKILL.md`, retained companion files, frontmatter name, and discovery policy; restart after installation.
- **Missing browser assets:** build the matching source checkout or reinstall the built release.
- **Port in use:** choose an available `--port` or stop the prior instance.

Report the installed revision/version, workspace path, provider/model selection, launch command, configured MCP and skill names, checks actually performed, and any remaining connection failures. Keep credentials out of the report.
