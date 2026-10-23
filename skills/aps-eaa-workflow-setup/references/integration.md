# EAA integration reference

## Provenance

Original APS Skills Hub instructions and example, authored for this catalog on 2026-10-23. Reviewed against **AdvancedPhotonSource/EAA commit `738960330cb66b3cf195d7e261def2e89ef5f9a8`**. These files are maintained in this hub's `skills/aps-eaa-workflow-setup/`, not in the EAA repository. EAA supplied no project license declaration at the reviewed revision; this package makes no additional upstream licensing claim.

Pinned sources:

- [README and migration notice](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/README.md)
- [Installation](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/docs/installation.md)
- [Model config](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/docs/llm-config.md)
- [Skills](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/docs/skills.md)
- [Tools and payloads](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/docs/tools.md)
- [Task manager and persistence](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/docs/task-manager.md)
- [BaseTaskManager implementation](https://github.com/AdvancedPhotonSource/EAA/blob/738960330cb66b3cf195d7e261def2e89ef5f9a8/packages/eaa-core/src/eaa_core/task_manager/base.py)

## Model selection

`OpenAIConfig` and `ArgoConfig` both take `model`, `base_url`, `api_key`, and optional `model_kwargs`. Argo's old `user` field is deprecated and ignored. `AskSageConfig` instead has `server_base_url`, `user_base_url`, `email`, and `cacert_path` as well as model/key fields. Use the project-provided settings.

By default, EAA derives provider caching options from the model identifier. A supplied `model_kwargs` mapping replaces the automatic options; an empty mapping disables those options. Use this only when diagnosing an endpoint's documented compatibility behavior.

## Existing MCP service

An HTTP client configuration has this shape; replace the illustrative endpoint with the actual service:

```python
from eaa_core.tool.mcp_client import MCPTool

remote = MCPTool({
    "mcpServers": {
        "experiment_tools": {
            "url": "http://127.0.0.1:8050/mcp",
            "transport": "http",
        }
    }
})
task_manager.register_tools(remote)
```

For stdio, replace that server entry with `{"command": "/path/to/python", "args": ["/path/to/server.py"]}`. The interpreter must contain the server's dependencies. A bare `{"url": ...}` without the `mcpServers` wrapper is not sufficient.

For new server implementations, consult the upstream [create-eaa-compatible-mcp-servers skill](https://github.com/AdvancedPhotonSource/EAA/tree/738960330cb66b3cf195d7e261def2e89ef5f9a8/developer_tools/create_eaa_compatible_mcp_servers), also available separately in the hub. Keep device execution in the project's chosen execution server; this setup skill does not define instrument operations.

## WebUI and memory extensions

Construct the manager with `use_webui=True`, `webui_runtime_host="127.0.0.1"`, and `webui_runtime_port=8010`. Then:

```python
from eaa_core.gui.html import launch_html_webui_subprocess

task_manager.start_webui_runtime()
ui = None
try:
    ui = launch_html_webui_subprocess(
        "http://127.0.0.1:8010", host="127.0.0.1", port=8008
    )
    task_manager.run_conversation()
finally:
    if ui is not None:
        ui.terminate()
    task_manager.stop_webui_runtime()
```

The two ports serve different roles; the browser UI proxies to the agent-owned runtime. For chat resume use `run_conversation_from_checkpoint()` with the correct checkpoint database and session ID; `run_from_checkpoint()` is for task managers implementing `task_graph`.

Memory is optional. Enable it with `MemoryManagerConfig(enabled=True, persist_directory=..., namespace=...)` only when requested and after installing `memory_chroma`. Keep its persistent directory separate from the checkpoint and transcript SQLite files.
