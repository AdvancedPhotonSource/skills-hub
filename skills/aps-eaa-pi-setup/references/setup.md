# Reviewed EAA-Pi sources

Reviewed on 2026-11-09 at EAA-Pi commit `27fa4514def06d143a3fac3ea5944349f25d2ece`:

- [README and quickstart](https://github.com/AdvancedPhotonSource/EAA-Pi/blob/27fa4514def06d143a3fac3ea5944349f25d2ece/README.md)
- [Installation and diagnostics](https://github.com/AdvancedPhotonSource/EAA-Pi/blob/27fa4514def06d143a3fac3ea5944349f25d2ece/docs/installation.md)
- [Configuration, providers, MCPs, and skills](https://github.com/AdvancedPhotonSource/EAA-Pi/blob/27fa4514def06d143a3fac3ea5944349f25d2ece/docs/configuration.md)

The complete repository tree at this revision contains no `SKILL.md`. EAA-Pi's dependency, pi-experiment-ops, supplies a `workspace-setup` skill during workspace initialization. This new Hub skill covers installation, diagnostics, and terminal/web integration based on EAA-Pi's own documented CLI. It does not replace that bundled skill or provide an MCP server endpoint.

## Shared configuration paths

| Path, relative to the workspace                 | Purpose                                 |
| ----------------------------------------------- | --------------------------------------- |
| `eaa-pi.json`                                   | Web host and port                       |
| `.pi-experiment-ops/agent/settings.json`        | Provider/model defaults and Pi settings |
| `.pi-experiment-ops/agent/models.json`          | Custom provider/model definitions       |
| `.pi-experiment-ops/agent/auth.json`            | Credentials and OAuth tokens            |
| `.pi-experiment-ops/agent/pi-permissions.jsonc` | Tool, MCP, and skill policies           |
| `.pi/mcp.json`                                  | MCP server configuration                |
| `.pi/skills/<name>/SKILL.md`                    | Workspace skills                        |

Use the guided CLI for ordinary configuration. It preserves existing entries, stores environment references where supported, and keeps the web and terminal interfaces aligned. Configuration and newly added skills take effect after restart. Legacy Python EAA instructions, including its `MCPTool` constructor and `/skill <name>` syntax, do not apply to EAA-Pi's CLI and `/skill:name` invocation.
