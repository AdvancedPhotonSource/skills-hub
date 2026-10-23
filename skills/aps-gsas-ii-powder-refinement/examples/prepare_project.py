"""Prepare a new GSAS-II powder project; do not run refinement.

Original example authored by APS Skills Hub against the pinned sources in
references/sources.md. Run with the Python interpreter used by GSAS-II.
"""

import argparse
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pattern", required=True, type=Path)
    parser.add_argument("--instrument", required=True, type=Path)
    parser.add_argument("--cif", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--gsas-root", type=Path,
                        help="Directory containing the GSASII package")
    args = parser.parse_args()

    for path in (args.pattern, args.instrument, args.cif):
        if not path.is_file():
            parser.error(f"Input file does not exist: {path}")
    output = args.output.resolve()
    if output.suffix.lower() != ".gpx":
        parser.error("Output must have a .gpx extension")
    if output.exists():
        parser.error(f"Choose a new output filename: {output}")
    if not output.parent.is_dir():
        parser.error(f"Output directory does not exist: {output.parent}")
    if args.gsas_root:
        root = args.gsas_root.resolve()
        if not (root / "GSASII" / "GSASIIscriptable.py").is_file():
            parser.error("--gsas-root must contain GSASII/GSASIIscriptable.py")
        sys.path.insert(0, str(root))

    from GSASII import GSASIIscriptable as G2sc

    G2sc.ShowVersions()
    project = G2sc.G2Project(newgpx=str(output))
    hist = project.add_powder_histogram(
        str(args.pattern.resolve()), iparams=str(args.instrument.resolve())
    )
    phase = project.add_phase(
        str(args.cif.resolve()), histograms=[hist], fmthint="CIF"
    )
    project.save()
    print(f"Prepared: {output}")
    print(f"Histogram: {hist.name}")
    print(f"Phase: {phase.name}")
    print("No refinement performed. Inspect the project before choosing refinement flags.")


if __name__ == "__main__":
    main()
