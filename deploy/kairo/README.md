# Kairo deployment

Live URL: **https://kairo.aps.anl.gov:8443** — Argonne networks and VPN.

## SSO deployed — 2026-11-06

**Current access policy:** every catalog page, API route, file, and download
requires a session created by a validated Entra callback. The server checks this
before route handlers or page loaders run. Only sign-in/callback/sign-out routes
and the assets needed to display sign-in are public. Local-password login and
registration are disabled, including when Entra configuration is missing.
Migration 7 labels legacy sessions as local, requiring one fresh SSO sign-in;
linked identities and existing ownership remain intact.

The SSO release was activated at **21:23 UTC** from
`releases/sso-20261106T211928Z`, replacing `preview-20261106-logo-final`.
The source archive is `incoming/sso-20261106T211928Z.tar.gz`, SHA-256
`6b57a43dd91bfd12aeb6341db9b29e560777de70a1384bb715d5aaa6eaf5a83c`.
`SOURCE-MANIFEST.json` in the release records every source file's hash.

The service loads `config/entra.env` through the Kairo systemd drop-in; the
credentials file uses `NAME=value` syntax and mode 0600. Schema migrations 5–6
were applied after a production backup. The pre-cutover database, previous
drop-in, release pointer, and deployment record are retained in
`incoming/sso-20261106T211928Z-cutover/`.

Verification on Kairo passed: type checking, all 47 unit tests, ARM64 production
build, and staging account-linking checks using the installed Entra configuration.
After cutover, public HTTPS browser checks passed for the SSO UI, Microsoft
authorization redirect, exact callback URI, secure cookies, cancellation recovery,
registration redirect, and cross-origin rejection. All 31 catalog detail pages
and five catalog/documentation/discovery routes returned successfully. Both
existing users, their identities and sessions, all 34 revisions, and 294 package
file hashes were preserved. The temporary staging service was stopped.

The initial deployment provided account linking using an existing Hub password.
That migration flow has now been retired in favor of SSO-only access. Users with
linked accounts choose **Sign in with Argonne** to retain their existing account.

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
- Release: `current` → `releases/sso-20261106T211928Z`
- Source base commit: `0ff0066687bbeae9811cd67472a755e89d4555ba`, with the
  working-tree source snapshot recorded in `SOURCE-MANIFEST.json`
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

## Certificate and SSO

The certificate is valid through **2027-05-22 18:54:26 UTC**. Its CN/SAN cover
`kairo.aps.anl.gov`, and its public key matches the private key generated on
Kairo. The installed chain contains the leaf and two intermediates, omitting
the self-signed root. Both Kairo and the Mac successfully verified TLS against
their normal trust stores.

Renew through the institutional InCommon ticket process before expiry. Install
the renewed full chain with its matching key, validate the Caddy configuration,
then restart `skills-hub-https.service` and verify the external URL.

### Entra OIDC configuration

Register this exact **Web** redirect URI in Entra (including port 8443):
`https://kairo.aps.anl.gov:8443/auth/callback/entra`.

The app uses the single Argonne tenant's discovery document:
`https://login.microsoftonline.com/0cfca185-25f7-49e3-8ae7-704d5326e285/v2.0/.well-known/openid-configuration`.
Scopes are `openid profile email`; no Graph permissions, custom claims, group
claims, or refresh tokens are required. Entra controls who can access the
enterprise application; configure it for all ANL users, with the intended
guest-access policy. Tenant validation alone does not exclude tenant guests.

Create `/local/haskels/skills-hub/config/entra.env` on Kairo with mode **0600**:

```dotenv
ENTRA_CLIENT_ID=<application-client-ID>
ENTRA_CLIENT_SECRET=<client-secret-VALUE>
ENTRA_TENANT_ID=0cfca185-25f7-49e3-8ae7-704d5326e285
ENTRA_REDIRECT_URI=https://kairo.aps.anl.gov:8443/auth/callback/entra
```

The updated `skills-hub.conf` loads this file through `EnvironmentFile`. Install
that drop-in as described above, deploy the rebuilt app, then run:

```sh
systemctl --user daemon-reload
systemctl --user restart skills-hub.service
```

Both client values must be present for sign-in to work; missing configuration
does not permit anonymous or local-password access. Keep the secret out of source
control and browser configuration. Rotate it by updating this file and restarting
the service before its Entra expiry. Node must be able to reach Microsoft's
discovery, token and signing-key endpoints over HTTPS.

### Accounts and traceability

New users register through Argonne sign-in. Each Hub user is
bound to the immutable `(tenant ID, Entra object ID)` pair; the current Argonne
username and optional email are refreshed from validated ID tokens at sign-in.
Contributions keep their existing Hub user ID. New accounts still require the
existing administrator verification before publishing; SSO does not grant admin
or publisher privileges. Password-only sessions cannot access any protected route,
even if the account has a linked Entra identity. Existing linked users simply
sign in through Argonne; permissions, ownership, and contribution history are preserved.

For any remaining legacy account, an administrator can link a user using an object ID confirmed
with the SSO administrator (the user's object ID, not the application/client ID):

```sh
DATA_DIR=/local/haskels/skills-hub/data npm run admin -- link-entra haskels <user-object-ID>
DATA_DIR=/local/haskels/skills-hub/data npm run admin -- identity haskels
```

The administrative command is idempotent. There is no automatic email/username
matching. If someone has already
created a separate SSO account, resolve that duplicate explicitly before linking.
The account page shows the linked Argonne username; the admin identity command
also shows the stable tenant/object ID for traceability.

### SSO verification after deployment

1. Without a session, confirm `/` redirects to `/sign-in` and API, data, file,
   and download requests return 401. A legacy local session must also be denied.
2. Open `/sign-in` and choose **Sign in with Argonne**.
3. Complete institutional sign-in and confirm the return to `/my-skills`.
4. Confirm
   `/account` shows the linked Argonne account and preserves an existing
   user's contributions and permissions. An SSO-only account has no local
   password-change form.
5. Sign out, then repeat SSO; confirm the same Hub account is used.
6. Cancel a sign-in and confirm a retry works. The callback must reject requests
   without their original browser cookie or with an expired/reused state.

Sign-out ends the Hub session; it does not sign the user out of other Microsoft
applications. No client secret is needed at build time. For local development,
register a separate localhost Web redirect URI, set `ENTRA_REDIRECT_URI` to it,
and launch Vite with environment variables exported (or
`node --env-file=.env node_modules/vite/bin/vite.js`). Include `BASE_PATH` in the
registered callback if deploying under a path prefix.

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
