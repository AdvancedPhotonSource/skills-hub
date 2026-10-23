"""Back up a live hub using SQLite's snapshot API and immutable package storage."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tarfile
import tempfile


def create_backup(data_dir, destination, keep=14, release=None):
    data_dir = Path(data_dir).resolve()
    destination = Path(destination).resolve()
    if keep < 1:
        raise ValueError("Keep at least one backup")
    if not (data_dir / "hub.sqlite").is_file():
        raise FileNotFoundError(data_dir / "hub.sqlite")
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    target = destination / ("skills-hub-" + timestamp + ".tar.gz")
    partial = target.with_suffix(target.suffix + ".partial")
    try:
        # Snapshot on local storage. Old packages remain immutable and retained,
        # so every revision in this DB snapshot stays available during archiving.
        with tempfile.TemporaryDirectory(prefix=".backup-", dir=data_dir.parent) as temp:
            snapshot = Path(temp) / "hub.sqlite"
            source = sqlite3.connect((data_dir / "hub.sqlite").as_uri() + "?mode=ro", uri=True)
            copied = sqlite3.connect(str(snapshot))
            try:
                source.backup(copied)
                if copied.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                    raise RuntimeError("Database snapshot failed its integrity check")
                revisions = copied.execute("SELECT id, files FROM revisions ORDER BY id").fetchall()
            finally:
                copied.close()
                source.close()
            metadata = {"createdAt": timestamp, "revisions": len(revisions)}
            if release:
                metadata["commit"] = subprocess.check_output(
                    ["git", "-C", str(release), "rev-parse", "HEAD"], text=True
                ).strip()
            manifest = Path(temp) / "backup.json"
            manifest.write_text(json.dumps(metadata, indent=2) + "\n")
            with partial.open("xb") as output:
                os.chmod(partial, 0o600)
                with tarfile.open(fileobj=output, mode="w:gz") as archive:
                    archive.add(snapshot, arcname="data/hub.sqlite")
                    archive.add(manifest, arcname="backup.json")
                    for revision_id, files_json in revisions:
                        folder = data_dir / "packages" / revision_id
                        for entry in json.loads(files_json):
                            path = folder / entry["path"]
                            if not path.is_file():
                                raise FileNotFoundError(path)
                            archive.add(path, arcname="data/packages/" + revision_id + "/" + entry["path"])
                output.flush()
                os.fsync(output.fileno())
        partial.replace(target)
        previous = sorted(path for path in destination.iterdir()
                          if re.fullmatch(r"skills-hub-\d{8}T\d{12}Z\.tar\.gz", path.name))
        for old in previous[:-keep]:
            old.unlink()
        return target
    finally:
        partial.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--release", type=Path)
    parser.add_argument("--keep", type=int, default=14)
    args = parser.parse_args()
    print(create_backup(args.data_dir, args.destination, args.keep, args.release))


if __name__ == "__main__":
    main()
