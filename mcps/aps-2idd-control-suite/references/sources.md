# Reviewed control-suite sources

This MCP integration documentation was authored by APS Skills Hub from public interfaces at commit `5180dd61714706f391648b83085680e9800e41aa` of `AdvancedPhotonSource/control_suite_mcp_aps_2idd`.

- [README: architecture, setup, tools, units, completion and artifact contracts](https://github.com/AdvancedPhotonSource/control_suite_mcp_aps_2idd/blob/5180dd61714706f391648b83085680e9800e41aa/README.md)
- [Package requirements and CLI entry point](https://github.com/AdvancedPhotonSource/control_suite_mcp_aps_2idd/blob/5180dd61714706f391648b83085680e9800e41aa/pyproject.toml)
- [FastMCP registration, schemas, configuration precedence, and image responses](https://github.com/AdvancedPhotonSource/control_suite_mcp_aps_2idd/blob/5180dd61714706f391648b83085680e9800e41aa/src/control_suite_mcp_aps_2idd/mcp_server.py)
- [Repository deployment configuration](https://github.com/AdvancedPhotonSource/control_suite_mcp_aps_2idd/blob/5180dd61714706f391648b83085680e9800e41aa/config.toml)

No applicable project license declaration was present in the reviewed repository tree. This is original integration documentation, not a redistribution of the control-suite implementation. It does not declare a license for that upstream project.

The reviewed source registers `evaluate_snapshot` even though the README tool list omits it. `set_config` and `set_attribute` functions exist in `create_mcp` but lack tool decorators there; do not assume they are exposed as MCP tools. Health-device coverage and `dump_array` behavior have inconsistent prose; inspect deployed tools and results rather than resolving those discrepancies by assumption.

Documentation and source inspection only; no beamline connection, motor operation, scan, detector recovery, or MDA processing was performed to validate this integration.
