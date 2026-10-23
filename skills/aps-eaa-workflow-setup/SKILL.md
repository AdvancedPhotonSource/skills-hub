---
name: aps-eaa-workflow-setup
description: Set up or troubleshoot APS Experiment Automation Agents (EAA) Python task managers, model endpoints, workspace tools, downloaded skills, MCP clients, and WebUI persistence. Use for eaa-core/eaa-imaging/eaa-spectroscopy integration or missing skills, tools, or images. Distinguishes the Python EAA runtime from its EAA-Pi successor.
compatibility: Python 3.11+, an EAA source checkout or installed eaa-core, and credentials for the chosen model service. Optional imaging, memory, and WebUI dependencies depend on the workflow. Reviewed against EAA commit 738960330cb66b3cf195d7e261def2e89ef5f9a8.
metadata:
  version: '1.0.0'
  author: APS Skills Hub
  source-repository: https://github.com/AdvancedPhotonSource/EAA
  source-commit: 738960330cb66b3cf195d7e261def2e89ef5f9a8
---

# Set up an EAA workflow

[EAA repository](https://github.com/AdvancedPhotonSource/EAA) · [Reviewed source and integration notes](references/integration.md)

This is a hub-authored skill based on the linked EAA documentation and implementation. It is not an upstream EAA skill or a claim of maintainer endorsement.

## Establish the target

1. Identify whether the project uses Python **EAA** (`eaa_core`, `eaa_imaging`, `eaa_spectroscopy`) or **EAA-Pi**. EAA's reviewed README announces migration to [EAA-Pi](https://github.com/AdvancedPhotonSource/EAA-Pi), built on [pi-experiment-ops](https://github.com/AdvancedPhotonSource/pi-experiment-ops). The Python APIs below apply to EAA; inspect the successor's own documentation if that is the target.
2. Read the existing driver, environment configuration, and installed package versions before changing them. In a source checkout, record `git rev-parse HEAD` and read the matching `docs/` pages; API differences take precedence over this snapshot.
3. Identify the model service and model name, workspace, skill directories, and the specific tools required. Obtain actual MCP transport/endpoint details from the project's configuration instead of inventing a beamline endpoint or PV.

## Install the appropriate package set

From an EAA checkout, choose the narrowest relevant workspace configuration:

```sh
uv sync --package eaa-core          # Runtime and general tools
uv sync --package eaa-imaging       # Includes the core runtime
uv sync --package eaa-spectroscopy  # Includes the core runtime
```

These are alternatives. For normal development across the repository, upstream recommends `uv sync --all-extras`. For an existing non-workspace environment, the distributions are `eaa-core`, `eaa-imaging`, and `eaa-spectroscopy`; install only the required ones. Built-in Chroma memory additionally needs the `memory_chroma` extra.

Confirm the interpreter and imports without starting an agent:

```sh
uv run python -c "import sys; from eaa_core.task_manager.base import BaseTaskManager; print(sys.executable)"
```

## Build the driver

Use [examples/terminal_agent.py](examples/terminal_agent.py) as a small terminal entry point. It reads the model, base URL, and key from `EAA_MODEL`, `EAA_BASE_URL`, and `EAA_API_KEY`; `--provider argo` selects `ArgoConfig`. Supply the service's real values through the environment, not committed source. AskSage needs its own config fields; consult the reference rather than forcing it into this example.

From the environment containing EAA, run:

```sh
python /path/to/aps-eaa-workflow-setup/examples/terminal_agent.py \
  --workspace /path/to/run-workspace \
  --skill-dir /path/to/downloaded-skills
```

The example registers a calculator and workspace file tool, uses separate checkpoint and transcript databases in the workspace, and enters a model-backed conversation. It does not attach a beamline control server. Replace or supplement the calculator with the task's documented domain tools; for an imaging example, upstream uses `SimulatedAcquireImage` from `eaa_imaging.tool.imaging.acquisition`.

Preserve EAA's serial tool-execution model. Configure built-in tools through `task_manager.tool_manager`, not invented constructor flags. `FileSystemTool.read_whitelist_paths` is an approval exemption in the reviewed implementation, not an operating-system read-only sandbox.

## Install skills and connect MCP tools

1. Extract each hub ZIP intact, retaining its `SKILL.md`, references, and examples in one folder. Add the parent directory or an individual skill directory to `skill_dirs`.
2. An explicit `skill_dirs` list replaces EAA's default list. Include the installed/bundled skill locations as well if they are needed; use real paths in this environment.
3. Use `/skill` to inspect discovery and `/skill <name>` to load a selected skill. EAA injects only `SKILL.md`; companion files must remain accessible to its file tools.
4. For an existing MCP service, construct `MCPTool` with a dictionary containing **`mcpServers`**, then pass it in `tools` or call `register_tools()`. See the HTTP/stdio recipes in [integration notes](references/integration.md).
5. Images returned by remote tools need an `img_path` that the EAA process can read. An absolute path on a different server does not transfer the file. Diagnose shared storage/path mapping before changing the model prompt.

## Diagnose and hand off

- Missing imports: compare the active interpreter with the package/workspace installation; do not install an unrelated package named `eaa`.
- Missing skill: check the extracted layout, configured directories, duplicate names, and file-tool visibility, then rebuild the task manager's catalog.
- Missing tool: inspect exposed names and duplicates, MCP transport, launch command, and discovery errors. MCP tool names must be unique.
- Missing images: check `img_path`, PNG creation, client-side readability, and payload handling. Keep numerical arrays in files or documented buffer payloads.
- WebUI/resume problems: distinguish the agent runtime (normally port 8010) from the browser UI (normally 8008); `session_db_path` is obsolete. Use `checkpoint_db_path` and `transcript_db_path` separately.

Deliver the driver/configuration, package versions or source commit, exact launch command, skill/tool inventory, and unresolved connection requirements. State which checks were actually performed; a valid import or script syntax check does not establish a successful model call or experiment.
