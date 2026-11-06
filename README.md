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
Publishing access is managed by the Hub administrator.
