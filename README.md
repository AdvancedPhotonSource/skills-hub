# APS Skills Hub

A lightweight, internal catalog for discovering and sharing Agent Skills at Argonne. One SvelteKit application, SQLite full-text search, and immutable packages on local disk.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run seed   # optional: six original example skills, with no demo login
npm run dev
```

Open http://127.0.0.1:5173. Create an account to publish; browsing and downloads work without signing in. Data lives in `data/` (ignored by Git). Set `DATA_DIR` to use another directory.

## Available now

- Responsive catalog, hierarchical categories, role/technology filters, full-text search, and shareable search URLs.
- Local accounts, My skills, password changes, and server-enforced ownership.
- SKILL.md/ZIP uploads, package previews, immutable revisions, historical downloads, and archival.
- Sanitized Markdown, file browsing, installation instructions, and browser-local saved skills.
- Read API: `GET /api/v1/skills`, `/api/v1/skills/:id`, and `/api/v1/categories`. Search accepts `q`, `category`, `role`, `tag`, `author`, `days`, `exact=1`, `sort=relevance|recent|downloads`, and `page` (20 results per page).

Git imports, MCP, richer collections/exports, and Entra OIDC are subsequent milestones. Contributors own entries through stable internal user IDs; authentication identities are separate for eventual SSO linking.

## Maintain

```sh
npm run admin -- promote username
npm run admin -- reset username
```

Run these commands on the host using the application's `DATA_DIR`. Reset prints a generated temporary password and revokes existing sessions. Deliver it privately; users can change it under Account. Administrators can manage any skill. Taxonomy is maintained in `src/lib/taxonomy.ts`.

Packages accept at most 10 MB compressed, 25 MB expanded, 200 files, and 5 MB per file. A ZIP contains one skill, either at its root or in a folder matching the `SKILL.md` name. Uploaded scripts are stored, never executed. Package files are written before the database transaction exposes a revision; failed transactions remove their files.

## Verify

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Tests use isolated temporary databases. Browser tests cover publishing, anonymous discovery/downloads, cross-account edit attempts, CSRF rejection, revisions, archival, password changes, mobile layouts, and automated accessibility checks. Screenshots are written to `test-results/`. Use `npm run format` before committing.

Use Conventional Commit titles for commits, PRs, and squash merges, such as `feat(catalog): add skill imports` or `fix(auth): invalidate recovered sessions`. Keep changes focused, code straightforward, and documentation here unless a concrete need warrants another document. UI clarity and accessibility are acceptance criteria, not a final polish step.

## Deploy on arecibo

Confirm the host's runtime, existing JMD proxy routes, certificate hostname coverage, and approved Argonne network/VPN ranges before deployment. TLS alone does not restrict access.

```sh
npm ci
npm run build
HOST=127.0.0.1 PORT=3000 BODY_SIZE_LIMIT=12M \
  ORIGIN=https://actual-certificate-covered-hostname \
  DATA_DIR=/persistent/local/path/skills-hub node build
```

Run as an unprivileged service behind the existing HTTPS proxy. Apply Argonne-only access rules to **all** application, API, file, and download routes. Keep the app's listener private. `ORIGIN` must match the browser-facing origin. Set `BASE_PATH` during the build if mounting below a path (for example `/skills-hub`); append that path to user-facing links, not `ORIGIN`. `.env.example` lists configuration; direct Node startup uses exported environment variables (or Node's `--env-file`).

Keep SQLite on local disk. For a simple consistent backup, stop the service, copy the entire data directory (database, WAL files if present, and packages), then restart. Restore into a separate directory and verify an account and historical download before relying on the backup. arecibo deployment and network restrictions have not yet been exercised.
