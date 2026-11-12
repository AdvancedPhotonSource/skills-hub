# Upstream skill updates

`skills-hub-sync.timer` runs the backend worker every hour against the same
`DATA_DIR` as the site. Install the service and timer in the deployment user's
`~/.config/systemd/user/`, then run `systemctl --user daemon-reload` and
`systemctl --user enable --now skills-hub-sync.timer`. Releases must include
`scripts/`, `src/`, and the `tsx` runtime dependency used by the worker.

An optional `GITHUB_TOKEN` in `/local/haskels/skills-hub/config/github.env`
(mode 0600) increases public GitHub API limits. The worker reads only public
repositories and never executes imported files.

Existing and new GitHub imports are discovered from the database automatically.
The worker resolves each repository/ref once per batch, compares the full package
(including inherited legal notices), and publishes only changed packages.
Explicit commit refs remain pinned; branch refs follow upstream. Starter-catalog
pins are used only for the first import.

Monitoring state and retry backoff are internal SQLite records. Failed imports
retain their last working revision; retries back off from one hour to 24 hours
and honor GitHub rate-limit reset times. A database lease prevents overlapping
workers. The UI continues to show only its existing imported-commit attribution.

Inspect backend operation using `systemctl --user status skills-hub-sync.timer`
and `journalctl --user -u skills-hub-sync.service`. The worker reports updated,
unchanged, failed, and deferred counts, and exits unsuccessfully on failed checks.
