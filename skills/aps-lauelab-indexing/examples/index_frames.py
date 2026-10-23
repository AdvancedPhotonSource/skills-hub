"""Hub-authored lauelab batch example; see ../references/sources.md."""

import argparse
import json
from importlib.metadata import version
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Index matching 34-ID-E HDF5 frames.")
    parser.add_argument("--geometry", required=True, type=Path)
    parser.add_argument("--crystal", required=True, type=Path)
    parser.add_argument("--detector-id", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("frames", nargs="+", type=Path)
    args = parser.parse_args()
    inputs = [args.geometry, args.crystal, *args.frames]
    if any(not path.is_file() for path in inputs):
        parser.error("Geometry, crystal, and all frame paths must be existing files.")
    if args.output.exists() or not args.output.parent.is_dir():
        parser.error("Choose a new output file in an existing directory.")

    from lauelab.indexing import Indexer

    indexer = Indexer(args.geometry, args.crystal, detector_id=args.detector_id)
    results = indexer.index_many(args.frames, keep_images=False)
    indexer.write_results(results, args.output)
    print(json.dumps({
        "lauelab_version": version("lauelab"),
        "geometry": str(args.geometry.resolve()),
        "crystal": str(args.crystal.resolve()),
        "detector_id": args.detector_id,
        "output": str(args.output.resolve()),
        "frames": [
            {
                "input": str(path.resolve()),
                "indexed": bool(result.indexed),
                "peaks": int(result.n_peaks),
                "patterns": int(result.n_patterns),
                "assignments": int(result.n_indexed),
                "unique_indexed_peaks": len(result.indexed_peak_indices),
            }
            for path, result in zip(args.frames, results, strict=True)
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
