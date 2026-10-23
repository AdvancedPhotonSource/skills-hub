---
name: aps-gsas-ii-powder-refinement
description: Prepare and inspect reproducible GSAS-II powder diffraction projects with GSASIIscriptable. Use for importing patterns and CIFs, matching instrument parameters, planning staged Rietveld refinements, checking residuals and covariance, and extending a validated model to a series. Covers the direct GSAS-II Python API rather than an APEXA or Agentic-GSAS-II wrapper.
compatibility: A working GSAS-II installation with its compiled extensions and Python environment; the reviewed package declares Python 3.10+, NumPy, SciPy, and PyCifRW. Requires measured powder data, matching instrument parameters, and a structural model for Rietveld analysis. Reviewed at a39f978abcd66cc234a170f11837578e87d3bf11.
metadata:
  author: APS Skills Hub
  version: '1.0.0'
  source-repository: https://github.com/AdvancedPhotonSource/GSAS-II
  source-commit: a39f978abcd66cc234a170f11837578e87d3bf11
---

# GSAS-II powder diffraction workflow

An original hub-authored guide to the direct GSAS-II scripting interface. See [pinned references and provenance](references/sources.md). Use the installed version's documentation when its API differs from this snapshot.

## Identify the experiment and model

Collect the measured pattern, radiation type, wavelength or TOF bank, instrument parameter file, intended phase CIFs, and output directory. Determine whether the x axis is 2θ, TOF, Q, or d-spacing and how uncertainties are represented. Do not label Q data as 2θ or supply weights as standard deviations. GSAS-II's histogram weights are `1/sigma**2`.

Instrument parameters determine the histogram's radiation/data type. Match the calibration, wavelength, geometry, and bank to the measurement; do not invent an instrument file to make an import succeed. Multi-bank data can require both `databank` (dataset position, starting at 1) and `instbank` (instrument parameter set).

Inspect starting CIFs for phase identity, space-group setting, occupancies, and plausibility. A Rietveld workflow requires a structural model; absent one, discuss indexing, structure solution, Pawley, or Le Bail analysis rather than treating a guessed structure as established.

## Use the installed GSAS-II interpreter

Follow the installation link in the [source notes](references/sources.md), using a supported GSAS-II environment with its native binaries. Installing this skill does not install GSAS-II. A source checkout alone is not evidence of working compiled extensions.

For an installation importable as a Python package:

```python
from GSASII import GSASIIscriptable as G2sc
G2sc.ShowVersions()
```

For an external checkout, add the directory **containing `GSASII/`** to `sys.path`, then use the same import. Older examples inserting the `GSASII/` directory itself refer to a different layout. An existing scripting shortcut also supports `import G2script as G2sc`. Use the environment that actually loads the installation rather than changing system Python.

Prefer the Python API: upstream discourages the older GSASIIscriptable shell-command interface. The GUI can open the same `.gpx` projects and remains useful for visual inspection and features outside the scripting API.

## Build an inspectable input project

Use [examples/prepare_project.py](examples/prepare_project.py) to import one pattern and one CIF into a new project without running refinement:

```sh
python /path/to/aps-gsas-ii-powder-refinement/examples/prepare_project.py \
  --pattern /data/sample.fxye \
  --instrument /data/instrument.instprm \
  --cif /data/phase.cif \
  --output /data/analysis/input.gpx
```

For a checkout outside the environment, add `--gsas-root /path/to/GSAS-II`. The example requires a new output filename. It uses `G2Project(newgpx=...)`, `add_powder_histogram(..., iparams=...)`, and `add_phase(..., histograms=[hist], fmthint="CIF")` to link the phase explicitly to the data. Use the appropriate importer hint or bank arguments for formats needing them.

Before refinement, inspect `hist.getdata("X")`, `hist.getdata("Yobs")`, and `hist.getdata("Yweight")`, respecting their masked-array semantics. Confirm the imported range, excluded regions, intensity scale, and usable uncertainties. Save this input state separately from refined output.

## Refine in explainable stages

Start from a copied project with `G2Project(gpxfile="input.gpx", newgpx="refined.gpx")`. Choose stages from the experiment and model; there is no universal parameter recipe.

1. Establish background and scale before freeing correlated structural and profile parameters. Keep instrument broadening anchored to its calibration unless recalibrating against a suitable standard.
2. Inspect residuals and peak positions before adding cell or geometry corrections. Distinguish wavelength/zero/displacement errors from structural changes.
3. Add justified profile, sample, and structural parameters progressively. Explain why each stage is identifiable from the data. Avoid simultaneous free occupancy/thermal/scale combinations without constraints and sufficient information.
4. Record flags and save named checkpoints with `do_refinements(..., outputnames=[...])`, or use `iter_refinements` to inspect each stage. A list containing one empty dictionary, `[{}]`, runs a refinement with existing settings; `set_refinement` changes settings without performing the refinement.

A minimal **illustration**, to adapt after inspecting the project's existing flags:

```python
project.do_refinements(
    [{"set": {"Background": {"no. coeffs": 3, "refine": True}}}],
    outputnames=["background-stage.gpx"],
)
```

This does not reset other flags and is not a complete Rietveld protocol. Consult the pinned refinement dictionaries for histogram, phase, and histogram-and-phase (HAP) settings before extending it.

## Evaluate and report

- `hist.get_wR()` reports the weighted profile R factor **as a percentage**, or `None` when undefined. Do not multiply by 100 again.
- Compare observed, calculated, background, and residual curves using `getdata("Yobs")`, `"Ycalc"`, `"Background"`, and `"Residual"`. Report systematic misfit as well as the scalar R factor.
- Inspect `get_LastFitResults()`, `get_Variable(...)`, and `get_Covariance(...)` for shifts, uncertainty, and correlations. Report singularities, unconstrained parameters, bounds, and absent uncertainties explicitly.
- Preserve the `.gpx`, input files, refinement recipe, version information, and stage outputs. Unit-cell results are available through `phase.get_cell()` / `get_cell_and_esd()`; `phase.export_CIF(...)` exports a phase, not a substitute for the full project and fit diagnostics.
- Low Rwp alone does not establish phase identity or a physically meaningful model. Separate a converged numerical fit from the scientific conclusions it supports.

For a series, first validate a representative pattern, define which parameters carry forward, and record the pattern order and failed fits. Independent repeated projects and GSAS-II sequential refinement are different procedures: use the documented sequential controls and `seqref()` only when that is the intended analysis.

Include the GSAS-II citation: Toby & Von Dreele (2013), _Journal of Applied Crystallography_ 46, 544–549, DOI `10.1107/S0021889813003531`, plus method-specific citations requested by the software.
