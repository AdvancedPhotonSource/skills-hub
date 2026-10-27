# APS Skills Hub

An internal catalog of Agent Skills and MCP servers for Argonne’s Advanced Photon Source. Built with SvelteKit, TypeScript, Node.js, and SQLite.

**Status: Beta.** Features and interfaces are still evolving.

## Shared instance

[https://arecibo.xray.aps.anl.gov:9005](https://arecibo.xray.aps.anl.gov:9005) — available on Argonne networks and VPN.

## API

A read-only REST API supports skill search, skill details, and category discovery. Browsing and downloads require no sign-in. See the [API documentation](https://arecibo.xray.aps.anl.gov:9005/docs/api) for endpoints and examples.

## Catalog administration

After backing up the database and packages, run `npm run curate -- haskels` once against the intended `DATA_DIR`. This assigns maintenance to Samuel Haskel, classifies existing entries, permanently deletes the retired starter imports and demo library, and publishes the discovery skill. The command is safe to rerun and preserves already-classified metadata.

Samuel verifies accounts with `npm run admin -- verify <username>` (or `unverify`). `npm run import:catalog` imports the APS-focused starter selection; `npm run seed` publishes only the local entries. New contributions default to Samuel as maintainer, with their submitter and upstream attribution retained separately.
