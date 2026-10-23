# APS Skills Hub

A lightweight, internal catalog for discovering and sharing Agent Skills at Argonne. One SvelteKit application, SQLite full-text search, and immutable packages on local disk.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run import:catalog   # optional: 16 source-linked skills from pinned GitHub commits
npm run dev
```

Open http://127.0.0.1:5173. Create an account to publish; browsing and downloads work without signing in. Data lives in `data/` (ignored by Git). Set `DATA_DIR` to use another directory.

## Available now

- Responsive catalog, hierarchical categories, role/technology filters, full-text search, and shareable search URLs.
- Local accounts, My skills, password changes, and server-enforced ownership.
- SKILL.md/ZIP uploads, package previews, immutable revisions, historical downloads, and archival.
- Public GitHub imports with directory selection, complete companion files, source/license links, pinned commits, and owner-requested refresh.
- Sanitized Markdown, file browsing, installation instructions, and browser-local saved skills.
- Read API: `GET /api/v1/skills`, `/api/v1/skills/:id`, and `/api/v1/categories`. Search accepts `q`, `category`, `role`, `tag`, `author` (hub maintainer or upstream publisher), `repository` (`owner/repo`), `origin=imported|uploaded`, `days`, `exact=1`, `sort=relevance|recent|downloads`, and `page` (20 results per page). Detail/revision records include import provenance.

MCP, richer collections/exports, and Entra OIDC are subsequent milestones. Contributors own entries through stable internal user IDs; authentication identities are separate for eventual SSO linking.

## Starter catalog and imports

`scripts/catalog.ts` records the curated repository paths, exact commits, license review, taxonomy, and example tasks. The selection includes 12 K-Dense scientific skills (exploration, visualization, statistics, materials, large arrays/tables) and four Anthropic development skills (frontend design, web testing, MCP, skill creation). SkillsMP is a discovery source; packages come directly from GitHub and are served from local storage afterward.

`npm run import:catalog` is repeatable and skips matching commits. Add `-- --archive-examples` to hide the original six demos after all imports succeed; their revisions are retained. Starter entries belong to the credential-free **APS curated library** account and can be maintained by a hub administrator. `npm run seed` remains available for a separate demo database.

To import your own selection, sign in, open **Upload → Import from GitHub**, find the repository's skills, select a directory, preview, classify, and publish. **Manage skill → Refresh from GitHub** checks the tracked branch/tag and creates an immutable revision if the commit changed; a commit-pinned ref stays pinned. Metadata edits retain source attribution. Modified upstream files should be published as a separate upload. Upstream publisher and local maintainer are displayed separately.

Imports preserve source bytes and executable flags, verify Git blob hashes, and include ancestor license/notice files under `_upstream/`. Per-skill license declarations are displayed verbatim alongside included terms; they can describe underlying libraries rather than the repository's own license. The selected Anthropic packages contain Apache-2.0 terms; K-Dense's repository license is MIT. Packages are reviewed starting points, not beamline-validated procedures; dependency requirements remain in their instructions. The importer never executes scripts.

Initial package smoke checks exercised downloaded CSV profiling, HDF5 hierarchy/dtype/shape inspection, and palette contrast auditing on synthetic inputs with Python 3.11 (plus h5py 3.16 for HDF5). These checks cover those bundled tools, not every workflow or agent's skill-selection behavior.

Only public HTTPS GitHub repositories are supported initially. Links, submodules, Git LFS pointers, incomplete repository trees, and oversized packages are rejected. An optional server-side `GITHUB_TOKEN` increases GitHub's API quota; it is sent only to `api.github.com`, never to browsers or raw-file hosts. No token is needed for browsing or downloading the local library.

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

Tests use isolated temporary databases. Backend tests cover import boundaries, integrity, licenses, branch resolution, and immutable provenance using mocked upstream responses. Browser tests cover publishing, anonymous discovery/downloads, cross-account edit/refresh attempts, CSRF rejection, revisions, archival, password changes, mobile layouts, and automated accessibility checks. Screenshots are written to `test-results/`. Use `npm run format` before committing.

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
