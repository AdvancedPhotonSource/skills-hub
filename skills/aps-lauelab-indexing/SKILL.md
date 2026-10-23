---
name: aps-lauelab-indexing
description: Prepare and troubleshoot Laue diffraction indexing with APS lauelab for 34-ID-E HDF5 frames or supported NumPy images. Use for detector/crystal setup, single-frame or batch indexing, peak and orientation interpretation, and HDF5/XML results. Explains coordinate conventions, native build requirements, and valid unindexed outcomes.
license: Upstream Argonne BSD-style notice is included in references/UPSTREAM-LICENSE.txt; hub-authored guidance and example are identified in references/sources.md.
compatibility: lauelab source installation on Linux x86-64 with GCC, Python 3.11–3.13, NumPy 2+, GSL and HDF5 development libraries. The reviewed upstream release does not support macOS or Windows. Requires matching detector geometry and crystal XML files.
metadata:
  version: '1.0.0'
  author: APS Skills Hub
  source-repository: https://github.com/AdvancedPhotonSource/lauelab
  source-commit: d5de751a8e8a01ac053ddb0b09c4d35a91a005da
---

# Index APS Laue diffraction frames

[Pinned references and provenance](references/sources.md)

Hub-authored guidance based on lauelab's public documentation. lauelab is alpha software; match the API to the installed revision before applying these instructions.

## Gather the actual inputs

- Frame paths or NumPy arrays, and the intended output directory.
- Geometry XML matching the detector and acquisition configuration.
- Crystal XML for the material being indexed.
- Detector identifier or physical slot; any crop, binning, mask, or reconstruction depth.
- Installed lauelab version/source commit and execution host.

Do not substitute the repository's nickel crystal or synthetic detector geometry for experimental calibration. The included Ni files are only matching inputs for the upstream synthetic example. If calibration or crystal information is absent, identify it as missing before preparing an indexing run.

## Establish the environment

The reviewed project builds native programs from source on **Linux x86-64 with GCC**. Python 3.11–3.13 is supported; the maintained Conda environment uses Python 3.12. The upstream installation requires GSL, HDF5 headers/libraries, zlib, CMake, Ninja, and OpenMP. Use a supported Linux host for execution when working from a Mac.

For a new source checkout:

```sh
git clone https://github.com/AdvancedPhotonSource/lauelab.git
cd lauelab
conda env create -f environment.yml
conda activate laue-analysis
python -m pip install .
python -c "from lauelab.indexing import Indexer, index_frame; print('import ok')"
```

Record `git rev-parse HEAD`. Consult that checkout's documentation if it differs from the reviewed commit in this package. Import success alone does not prove the native indexing library can load; the upstream installation guide includes a separate native-library diagnostic. CPU indexing needs no CUDA; the package does not build the separate GPU reconstruction executable.

## Check frame and coordinate conventions

- Path input uses the **34-ID-E HDF5 layout**, with the image at `entry1/data/data`. A generic HDF5 file is not automatically compatible; inspect its layout first or explicitly load an appropriate NumPy frame.
- Arrays have shape `(ny, nx)` and use `image[y, x]`. Peak positions and `start`/`group` arguments use zero-based `(x, y)` order.
- Supported image dtypes at the reviewed revision are `uint8`, `int8`, `uint16`, `int16`, `int32`, `float32`, and `float64`. Floating values must be finite. Choose explicit conversions rather than silently narrowing unsupported types.
- HDF5 detector `startx/starty/binx/biny` values override `start` and `group` passed to indexing. Check those values when a cropped/binned result looks displaced.
- Masks must match the frame shape; nonzero pixels are excluded.
- A geometry slot is a **physical slot**, not the position in a list of active detectors. Prefer an exact `detector_id` when available. Do not fall back to another detector after a mismatch.
- Geometry lengths and reconstruction depth use micrometres. Do not infer the physical sign of reconstruction depth from an array index.

## Prepare a single-frame or batch workflow

For one frame, use `index_frame(frame, geometry=..., crystal=...)`. For repeated frames sharing configuration, reuse `Indexer(geometry, crystal, detector_id=...)`.

The companion [examples/index_frames.py](examples/index_frames.py) accepts explicit HDF5 paths, calibration files, and detector ID, then writes one results HDF5 file:

```sh
python /path/to/aps-lauelab-indexing/examples/index_frames.py \
  --geometry /path/to/geometry.xml --crystal /path/to/crystal.xml \
  --detector-id 'EXACT DETECTOR ID FROM GEOMETRY' \
  --output /path/to/new-indexed-results.h5 \
  /path/to/frame-001.h5 /path/to/frame-002.h5
```

`index_many()` is sequential, preserves input order, and defaults to not retaining images. It stops on the first exception and does not return partial results. For a workflow that must record individual failures, call `index()` per frame and handle expected input/numerical failures deliberately. For large jobs, consult upstream `iter_index()` and the streaming results writer; use process workers rather than simultaneous calls on one `Indexer` from threads.

## Interpret and export

Report `n_peaks`, `n_patterns`, `indexed`, and `n_indexed` per frame. **`n_indexed` counts assignments across patterns**, potentially counting a peak more than once; `len(result.indexed_peak_indices)` gives the unique indexed-peak count.

`result.peaks` is a structured array with `fit_x`, `fit_y`, `qhat`, and other measurements. `pattern.pk_index` indexes that peak array. Euler angles are degrees; exchanging orientations with another program requires checking basis conventions, not just matching three numbers. The reciprocal basis uses rows in `1/nm` and includes the `2*pi` factor.

No peaks, or peaks with no identified orientation, are valid outcomes. Keep them distinct from bad input or native errors. Do not describe indexing alone as a validated strain measurement.

Use `indexer.write_results(results, output)` for analysis and visualization; its default rejects an existing destination. For LaueGo interchange, `result.write_xml(path)` or `indexer.write_many_xml(results, path)` is explicit and replaces existing XML destinations. Preserve input files and use new output paths.

## Diagnose and hand off

- `KeyError`/`OSError`: inspect the HDF5 dataset and file access.
- `InputError`: inspect dimensions/dtype, detector match, crop/binning, mask, and configuration.
- `IndexingError` or native failure: retain the stage/error context and package/native-library versions; do not repeatedly retry unchanged invalid input.
- `liblaue.so` load failure: activate the environment supplying compatible GSL/HDF5 libraries; Python environment activation and native-library resolution must agree.

Deliver the reproducible command/script, input and calibration provenance, parameter choices, summary of indexed and unindexed frames, output paths, and any failures. Separate prepared code from runs actually executed.
