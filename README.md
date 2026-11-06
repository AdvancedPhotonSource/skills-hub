# APS Skills Hub

An internal catalog of Agent Skills and MCP servers for Argonne’s Advanced Photon Source. Built with SvelteKit, TypeScript, Node.js, and SQLite.

**Status: Beta.** Features and interfaces are still evolving.

## Shared instance

[https://kairo.aps.anl.gov:8443](https://kairo.aps.anl.gov:8443) — available on Argonne networks and VPN. See [deployment notes](deploy/kairo/README.md).

## API

A read-only REST API supports skill search, skill details, and category discovery. All pages, API reads, file access, and downloads require an Argonne SSO session, enforced on the server. See the [API documentation](https://kairo.aps.anl.gov:8443/docs/api) for endpoints and examples.

## Argonne sign-in

Configure Entra OIDC using `ENTRA_CLIENT_ID` and `ENTRA_CLIENT_SECRET`.
The registered Web callback is `https://kairo.aps.anl.gov:8443/auth/callback/entra`.
See [SSO setup and account linking](deploy/kairo/README.md#entra-oidc-configuration)
for deployment instructions. Local-password login and registration are disabled.
Missing SSO configuration fails closed. Sessions must record a successful Entra
authentication; a linked profile or a legacy session is insufficient. SSO accounts retain a
stable Argonne identity association; publishing verification remains managed by
the Hub administrator.

## Catalog administration

After backing up the database and packages, run `npm run curate -- haskels` once against the intended `DATA_DIR`. This assigns maintenance to Samuel Haskel, classifies existing entries, permanently deletes the retired starter imports and demo library, and publishes the discovery skill. The command is safe to rerun and preserves already-classified metadata.

Samuel verifies accounts with `npm run admin -- verify <username>` (or `unverify`). `npm run import:catalog` imports the APS-focused starter selection; `npm run seed` publishes only the local entries. New contributions retain their submitter as maintainer, with upstream attribution recorded separately.
