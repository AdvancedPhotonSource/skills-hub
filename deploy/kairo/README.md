# Kairo deployment

Live URL: **https://kairo.aps.anl.gov:8443** — Argonne networks and VPN.

## Migration completed — 2026-11-05

Kairo is authoritative. The app, HTTPS proxy and daily backup timer run as
`haskels`, with user-service lingering enabled for startup without an SSH login.
HTTPS uses the InCommon certificate and unprivileged port 8443; no administrator
setup on port 443 is needed. The earlier port-443 installation script has been
withdrawn.

Arecibo's `skills-hub.service`, `skills-hub-tls.service` and
`skills-hub-backup.timer` are stopped and disabled. Neither its app port 19005 nor
its HTTPS port 9005 is listening. The old release/data and final backup are
retained for recovery.

The final source archive is `skills-hub-20261105T201749513589Z.tar.gz`, SHA-256
`6997ad5977395f08c31a4b219590a7558a9d7d6d3ddfcfacec3e82ade6a131e8`.
It contains 2 users, 1 identity, 1 session, 19 entries, 21 revisions and 159
package files. All file hashes, SQLite integrity and foreign keys were verified
before the restored data was activated. The archive is retained in:

- Arecibo: `/local/haskels/skills-hub/migration-kairo/final-20261105/`
- Kairo: `/local/haskels/skills-hub/incoming/`
- Local Mac: `data/kairo-migration/` (ignored by Git)

The discovery entry was subsequently published as revision 2, changing its
default URL to Kairo:8443 while preserving its ownership, classification and
historical revision. The resulting catalog has 22 revisions. Temporary staging
test accounts are absent from the production database.

## Runtime and files

- Base directory: `/local/haskels/skills-hub/`
- Release: `current` → `releases/4d0c6ea`
- Source commit: `4d0c6ea553b9f2158ca84cae0ccdb86e0d19318b` (the former live release)
- Migration overlay: updated discovery URL, targeted publication script and
  deployment documentation/configuration; the local main branch is newer
- Runtime: `runtime/node/bin/node` (Node 24.22.2, Linux ARM64)
- HTTPS proxy: `runtime/caddy` (Caddy 2.11.9, Linux ARM64)
- Database/packages: `data/` on local XFS, not NFS
- Proxy configuration: `config/Caddyfile`
- Certificate chain: `tls/kairo.aps.anl.gov.fullchain.pem`
- Private key: `tls/kairo.aps.anl.gov.key` (mode 0600)
- Daily backups: `~/.skills-hub/backups` on home storage, retaining 14 archives

The app listens only on `127.0.0.1:19005`. The proxy listens on 8443, restricts
access to Argonne/VPN networks, terminates TLS and supplies the client address
through one trusted proxy hop. The app origin is
`https://kairo.aps.anl.gov:8443`.

Install the base `deploy/skills-hub.service`, `deploy/skills-hub-backup.service`
and `deploy/skills-hub-backup.timer` as user units. Install this directory's
`skills-hub.conf` as `~/.config/systemd/user/skills-hub.service.d/kairo.conf`, and
`skills-hub-https.service` as a user unit. Copy this directory's `Caddyfile` to
`/local/haskels/skills-hub/config/Caddyfile`.

## Operations

Run on Kairo as `haskels`:

```sh
systemctl --user status skills-hub.service skills-hub-https.service skills-hub-backup.timer
systemctl --user start skills-hub-backup.service
journalctl --user -u skills-hub.service -u skills-hub-https.service
```

The marker `/local/haskels/skills-hub/https-ready` exists for normal service.
Removing it puts external requests into maintenance mode (HTTP 503); loopback
requests remain available for checks. Recreate it only when the database and
application are ready to accept traffic.

For a database restore, enter maintenance mode and stop the app, backup timer
and any running backup job. Restore into a new directory and verify the archive,
database and packages before swapping the data directories. Do not copy over a
running SQLite database. Start the app, verify it locally through HTTPS, then
recreate the readiness marker and restart the backup timer.

The discovery download embeds `skills/aps-hub-discovery/SKILL.md` at build time.
To update its catalog package after changing and rebuilding that file, run only:

```sh
cd /local/haskels/skills-hub/current
export PATH=/local/haskels/skills-hub/runtime/node/bin:$PATH
DATA_DIR=/local/haskels/skills-hub/data node_modules/.bin/tsx scripts/update-discovery.ts haskels
```

The script preserves the existing entry's metadata and other files and does
nothing if the source is already current. Broad seed/curation commands are not
part of deployment or restoration.

## Certificate and future SSO

The certificate is valid through **2027-05-22 18:54:26 UTC**. Its CN/SAN cover
`kairo.aps.anl.gov`, and its public key matches the private key generated on
Kairo. The installed chain contains the leaf and two intermediates, omitting
the self-signed root. Both Kairo and the Mac successfully verified TLS against
their normal trust stores.

Renew through the institutional InCommon ticket process before expiry. Install
the renewed full chain with its matching key, validate the Caddy configuration,
then restart `skills-hub-https.service` and verify the external URL.

Future SSO registration must use the exact origin
`https://kairo.aps.anl.gov:8443`, including the port. SSO has not been implemented
as part of this migration.

## Verification performed

- Type checking and the production build passed on ARM64; the baseline's 24
  unit tests passed during staging.
- HTTPS registration, password verification, Secure/HttpOnly cookies,
  authenticated account access, sign-out, sign-in and cross-origin rejection
  passed against the staging database before final restoration.
- The targeted discovery update preserved other entries and metadata; rerunning
  it made no additional revision.
- After final restoration, all 19 detail pages, detail APIs and package ZIPs
  passed; 145 latest-revision file hashes were checked.
- External HTTPS returned 200 with successful TLS verification, and the home,
  sign-in, API documentation, category/catalog APIs and discovery download
  passed checks.
- A manual production backup succeeded and the daily timer is active.

## Recovery

Kairo now accepts writes. Restoring the old Arecibo snapshot would lose changes
made since cutover. If recovery on Arecibo is necessary, first enter maintenance
mode on Kairo, stop writes, take and verify a current backup, and reconcile the
data and origin settings before reopening any service. Keep only one writable
instance active.
