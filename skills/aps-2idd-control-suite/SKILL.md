---
name: aps-2idd-control-suite
description: Configure, inspect, and troubleshoot the APS 2-ID-D control-suite FastMCP gateway to Bluesky QueueServer. Use for MCP connection setup, beamline health, existing MDA/XRF image processing, scan payloads, or sample versus zone-plate motion semantics. Covers tool names, units, artifact paths, and plan/function completion contracts.
compatibility: Python 3.11+, the control-suite-mcp-aps-2idd package, an HTTP MCP client, and the configured beamline QueueServer. Processing needs access to the MDA/HDF5 data on the service host. Reviewed at commit 5180dd61714706f391648b83085680e9800e41aa.
metadata:
  author: APS Skills Hub
  version: '1.0.0'
  source-repository: https://github.com/AdvancedPhotonSource/control_suite_mcp_aps_2idd
  source-commit: 5180dd61714706f391648b83085680e9800e41aa
---

# APS 2-ID-D control-suite integration

An original hub-authored workflow based on the [reviewed sources](references/sources.md). The package provides instructions; the MCP service and beamline environment are separate installations.

## Establish the connection

1. Locate the control-suite checkout, its revision, the deployed TOML configuration, and the client's HTTP MCP configuration. The architecture is **MCP client → FastMCP HTTP → REManagerAPI → Bluesky QueueServer**. There is no local RunEngine in the gateway.
2. In the intended Python environment, install from that checkout with `python -m pip install -e .`. The declared dependencies include FastMCP 3+, bluesky-queueserver-api, h5py, matplotlib, NumPy, and SciPy.
3. Read the actual `config.toml` before starting a service. The checked-in file contains beamline-specific addresses and ranges; obtain deployment values from the existing installation. CLI flags override TOML. The parser defaults to loopback, but the reviewed repository configuration binds to `0.0.0.0`.
4. Start with `control-suite-aps-2idd-mcp --config /path/to/config.toml`. For a service bound locally on the documented port/path, connect to `http://127.0.0.1:8050/mcp`; a remote client uses the configured service hostname instead.
5. List the server's advertised tools. Call `aps2idd_control.health` and `aps2idd_control.get_state` to distinguish MCP connectivity from QueueServer availability and current state. Tool discovery is authoritative for the running version.

The upstream client configuration shape is:

```json
{
	"mcpServers": {
		"control-suite-aps-2idd": {
			"url": "http://127.0.0.1:8050/mcp",
			"transport": "http"
		}
	}
}
```

Adapt that shape to the chosen client's HTTP transport configuration; not every client accepts the same JSON schema.

## Choose the tool matching the task

All names below have the `aps2idd_control.` prefix.

| Task                       | Tool and interpretation                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Inspect connectivity/state | `health()`, `get_state()`                                                                                                         |
| Locate current data        | `get_save_data_path()`, `get_current_mda_file()`; the latter can report the next scan's filename when queried outside acquisition |
| Inspect beamline health    | `get_global_health_snapshot()` for raw PV information plus evaluation; `evaluate_snapshot()` for the verdict alone                |
| Re-render acquired data    | `process_image(current_mda_file, save_data_path, plot_in_log_scale, show_colorbar, channels)`                                     |
| Acquire a 2D scan          | `acquire_image(width, height, x_center, y_center, stepsize_x, stepsize_y, dwell_ms)`                                              |
| Acquire a 1D scan          | `acquire_line_scan(positioner_name, length, stepsize, center, sample_x, sample_y, sample_z, energy, dwell_ms)`                    |
| Move sample                | `move_sample(axis, position)` with `axis` x/y/z                                                                                   |
| Move zone plate            | `move_zp_z(position)`; `set_parameters(parameters)` also moves zp-z using `parameters[0]`                                         |
| Inspect adapter attributes | `get_attribute_payload(name)`; array payloads encode dtype, shape, and base64 bytes                                               |
| Recover a detector         | `recover_detector(device_name, retries=1)`; this changes instrument state, pausing/resuming an active run as described upstream   |

For an existing-data request, use `process_image`, not acquisition. Provide the known scan file and service-visible directory explicitly rather than relying on whichever scan is current. It produces artifacts but submits no new QueueServer scan plan.

Example arguments for an existing file (replace the illustrative path, filename, and channel with the dataset's values):

```json
{
	"current_mda_file": "2idd_0315.mda",
	"save_data_path": "/path/to/acquired-data",
	"plot_in_log_scale": false,
	"show_colorbar": true,
	"channels": ["Cr"]
}
```

## Preserve scan semantics

- Image geometry and sample x/y/z are in microns. An energy line scan uses keV for length, center, and step size. `dwell_ms` is explicitly milliseconds; do not transfer a configured dwell value into it without checking its conversion in the installed backend.
- A line scan's `center` is a **relative offset** from the position at scan time. The optional sample/energy targets move to absolute positions first. `center=0` is not an instruction to move to the coordinate origin.
- For a supplied driven-axis absolute target, the extent is `target + center ± length/2`. Upstream only checks the absolute scan extent when that target is supplied; omitted targets are not evidence that the extent has been validated. Use the actual position and configured axis range when preparing a scan.
- Sample z and zone-plate z are distinct. They use `allowable_z_range` and `allowable_zp_range` respectively. `set_parameters` is a motion tool, not a harmless configuration setter.
- QueueServer plans return `item_uid`. Completion is read from manager state and history; `task_uid` belongs to QueueServer functions. Do not interpret submission or a progress notification as completion, or resubmit a timed-out acquisition without checking history.

## Interpret results and diagnose gaps

Return the reported `item_uid`, `run_uids`, `scan_ids`, `current_mda_file`, and `save_data_path` when present. Acquisition captures the MDA name before the savedata counter advances. Prefer that returned filename to a fresh current-file query.

Image tools return absolute `img_path` and `raw_data_path` on the **service host**. `process_image` also reports channel, HDF5, and MDA paths. These paths are not automatically readable on the client's machine. MCP image content is enabled by default; `--no-include-images` omits it while retaining the JSON payload. Line scans may include `gaussian_fit_params`; report missing fits rather than manufacturing FWHM values.

For connection failures, distinguish the HTTP host/port/path, QueueServer control/info addresses, plan/function availability, and data access. Health coverage comes from the deployed monitor manifest: the reviewed README and tool docstring disagree about detector coverage, so inspect the returned `devices` and timestamps before claiming a device was checked. The README and `dump_array` docstring also differ; inspect the installed backend and actual result before relying on image buffers.

Deliver a short connection/configuration summary, exact tool arguments and returned artifact paths, and any unresolved mismatch. Distinguish a prepared request from a completed scan or successful data-processing result.
