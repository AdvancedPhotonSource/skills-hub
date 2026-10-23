import importlib.util
import json
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("backup", Path(__file__).parents[1] / "deploy/backup.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTest(unittest.TestCase):
    def test_live_wal_snapshot_packages_and_retention(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            package = data / "packages" / "revision-1"
            package.mkdir(parents=True)
            (package / "SKILL.md").write_text("test skill")
            script = package / "example.sh"
            script.write_text("#!/bin/sh\nexit 0\n")
            script.chmod(0o755)
            live = sqlite3.connect(str(data / "hub.sqlite"))
            try:
                live.execute("PRAGMA journal_mode=WAL")
                live.execute("CREATE TABLE revisions (id TEXT, files TEXT)")
                live.execute("INSERT INTO revisions VALUES (?, ?)", (
                    "revision-1", json.dumps([{"path": "SKILL.md"}, {"path": "example.sh"}])
                ))
                live.commit()
                first = backup.create_backup(data, root / "backups", keep=1)
                second = backup.create_backup(data, root / "backups", keep=1)
                self.assertFalse(first.exists())
                self.assertTrue(second.exists())
                with tarfile.open(second) as archive:
                    self.assertEqual(archive.extractfile("data/packages/revision-1/SKILL.md").read(), b"test skill")
                    self.assertEqual(archive.getmember("data/packages/revision-1/example.sh").mode & 0o777, 0o755)
                    restored = root / "restored.sqlite"
                    restored.write_bytes(archive.extractfile("data/hub.sqlite").read())
                with sqlite3.connect(str(restored)) as restored_db:
                    self.assertEqual(restored_db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                    self.assertEqual(restored_db.execute("SELECT id FROM revisions").fetchone()[0], "revision-1")
                script.unlink()
                with self.assertRaises(FileNotFoundError):
                    backup.create_backup(data, root / "backups", keep=1)
                self.assertTrue(second.exists())
                self.assertEqual(list((root / "backups").glob("*.partial")), [])
            finally:
                live.close()


if __name__ == "__main__":
    unittest.main()
