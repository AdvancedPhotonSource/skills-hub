# APS Skills Hub

An internal catalog of Agent Skills and MCP servers for Argonne’s Advanced Photon Source. Built with SvelteKit, TypeScript, Node.js, and SQLite.

**Status: Beta.** Features and interfaces are still evolving.

## Shared instance

[https://kairo.aps.anl.gov:8443](https://kairo.aps.anl.gov:8443) — available on Argonne networks and VPN.

## API

A read-only REST API supports skill search, skill details, and category discovery. All pages, API reads, file access, and downloads require an Argonne SSO session, enforced on the server. See the [API documentation](https://kairo.aps.anl.gov:8443/docs/api) for endpoints and examples.

## Authentication

Skills Hub uses **Microsoft Entra ID single sign-on (SSO) via OpenID Connect (OIDC)**.
Sign in with your Argonne credentials; there is no separate Skills Hub password login.
All site content requires an authenticated SSO session, enforced on the server.

A Hub profile linked to your Argonne identity tracks contributions and permissions.
Every SSO-signed-in user can publish skills and MCPs without administrator approval.
Editing and deleting existing entries is restricted to their owners, maintainers, and administrators.

## Catalog maintenance

Source selections and owner assignments are in `scripts/catalog.ts` and `scripts/catalog-owners.ts`. Facility and beamline choices are in `src/lib/contexts.ts`.

After backing up the data directory, run with Node 24+ and development dependencies installed:

```sh
export DATA_DIR=/path/to/data
npm run refine:catalog -- <admin-username>
npm run import:catalog -- --local-only --skill aps-eaa-pi-setup
```

Both commands are repeatable. Upstream owner profiles have no login credentials; append `github-login=hub-username` to the refinement command to map a confirmed Hub account. Unrecognized historical beamline tags are reported for manual correction.
