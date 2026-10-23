# Sources and scope

This package is original **APS Skills Hub** guidance with a hub-authored example using the documented lauelab API. It was prepared on 2026-10-23 against **AdvancedPhotonSource/lauelab commit `d5de751a8e8a01ac053ddb0b09c4d35a91a005da`**. It is maintained in this hub's `skills/aps-lauelab-indexing/`, not published by the upstream lauelab maintainers.

The upstream Argonne notice is preserved in [UPSTREAM-LICENSE.txt](UPSTREAM-LICENSE.txt). The guide and example here are additions/adaptations, not an unchanged upstream distribution. lauelab builds on LaueGo by Jon Z. Tischler and collaborators; use the project's [acknowledgments and citations](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/acknowledgments.md) when reporting scientific use.

## Reviewed documentation

- [README](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/README.md): scope, source installation, public indexing entry points.
- [Installation](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/installation.md): supported platforms, native dependencies, diagnostics, CPU/GPU distinction.
- [Quickstart](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/quickstart.md): matching synthetic Ni inputs and basic use.
- [Frame inputs](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/guides/frame-input.md): HDF5 paths, supported dtypes, crop/group precedence, masks and depth.
- [Geometry](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/guides/geometry.md): physical detector slots, units, pixel coordinates.
- [Results](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/guides/results.md): assignment versus unique-peak counts, orientation conventions, export semantics.
- [Batch indexing](https://github.com/AdvancedPhotonSource/lauelab/blob/d5de751a8e8a01ac053ddb0b09c4d35a91a005da/docs/guides/batch-indexing.md): sequential execution, early failure, process workers, HDF5 output.

The bundled example uses the sequential path and default processing parameters. It does not perform geometry calibration, wire-scan reconstruction, parameter optimization, or strain fitting. It has not been validated on experimental beamline data. Before changing this skill, recheck the named APIs and conventions at the new upstream revision and update the recorded commit.
