# APS Skills Hub

An internal catalog of agent skills and MCP servers for the APS. Built with SvelteKit, TypeScript, Node.js, and SQLite.

## Shared instance

[https://skills.aps.anl.gov:8443](https://skills.aps.anl.gov:8443) — available on Argonne networks and VPN.

## API

A read-only REST API supports skill search, skill details, and category discovery. All pages, API reads, file access, and downloads require an Argonne SSO session, enforced on the server. See the [API documentation](https://skills.aps.anl.gov:8443/docs/api) for endpoints and examples.

## Authentication

The APS Skills Hub uses **Microsoft Entra ID single sign-on (SSO) via OpenID Connect (OIDC)**.
Sign in with your Argonne credentials; there is no separate Skills Hub password login.
All site content requires an authenticated SSO session, enforced on the server.

A "Hub profile" linked to your Argonne identity tracks contributions and permissions.
Every SSO-signed-in user can publish skills and MCPs without administrator approval.
Editing and deleting existing entries is restricted to their owners.

## Collections

Choose **Collection** on the Publish page to group two or more of your published skills or MCPs. Collections have their own owner, repository link, Explore card, and a ZIP download containing the latest published files of each available entry. Entries retain their individual ownership and source history. Explore groups members under their collection on the unfiltered landing page; searches and type filters also find individual entries.

Run `npm run import:collections` to import the Ptychodus and APEXA collections into the configured `DATA_DIR` (defaults to local `data/`). The importer discovers all skills in the requested upstream directories, reuses existing repository/directory identities, stops on conflicting names, and assigns the reviewed owners. Re-running it does not duplicate skills or replace existing packages. This command does not deploy the site or push to GitHub.
