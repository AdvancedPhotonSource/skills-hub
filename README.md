# APS Skills Hub

A lightweight, internal catalog for discovering and sharing Agent Skills at Argonne. One SvelteKit application, SQLite full-text search, and immutable packages on local disk.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run import:catalog   # optional: curated upstream and hub-authored APS skills
npm run dev
```

Open http://127.0.0.1:5173. Create an account to publish; browsing and downloads work without signing in. Data lives in `data/` (ignored by Git). Set `DATA_DIR` to use another directory.

## Available now

- Responsive catalog, hierarchical categories, role/technology filters, full-text search, and shareable search URLs.
- Local accounts, My skills, password changes, and server-enforced ownership.
- SKILL.md/ZIP uploads, package previews, immutable revisions, historical downloads, and archival.
- Public GitHub imports with directory selection, complete companion files, source/license links, pinned commits, and owner-requested refresh.
- Sanitized Markdown, file browsing, installation instructions, and browser-local saved skills.
- Prompt/command installation with visible, copyable text and npx/bunx/pnpm options; a collapsible, color-coded file explorer with file sizes.
- Read API: `GET /api/v1/skills`, `/api/v1/skills/:id`, and `/api/v1/categories`. Search accepts `q`, `category`, `role`, `tag`, `author` (hub maintainer or upstream publisher), `repository` (`owner/repo`), `origin=imported|uploaded`, `days`, `exact=1`, `sort=relevance|recent|downloads`, and `page` (20 results per page). Detail/revision records include import provenance.
- **API Docs** at `/docs/api`: endpoint and parameter reference, cURL/JavaScript/Python examples, copy controls, and a live read-only request playground with formatted JSON and HTTP status. The footer links here; machine endpoints continue to return JSON.

MCP, richer collections/exports, and Entra OIDC are subsequent milestones. Contributors own entries through stable internal user IDs; authentication identities are separate for eventual SSO linking.

## Starter catalog and imports

`scripts/catalog.ts` records the curated repository paths, exact commits, license review, taxonomy, and example tasks. The 26-skill selection includes 12 K-Dense scientific skills, four Anthropic development skills, nine APS-specific entries, and Browser Use. SkillsMP and the APS GitHub organization are discovery sources; imported packages come directly from GitHub and are served from local storage afterward.

| APS skill                                         | Source and scope                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-plugin`, `add-reconstructor`, `check-layers` | Imported unchanged from Ptychodus's `.claude/skills/`; use within a Ptychodus checkout, with its `CLAUDE.md` and companion development skills.                                                                              |
| `create-eaa-compatible-mcp-servers`               | Imported unchanged from EAA's `developer_tools/`; instrument-gateway design and payload contracts. Upstream supplies no applicable license declaration at the reviewed revision.                                            |
| `aps-eaa-workflow-setup`                          | Hub-authored in `skills/`; Python EAA setup, skills, MCP, persistence, and a terminal-agent example. Records the upstream EAA-Pi migration notice.                                                                          |
| `aps-lauelab-indexing`                            | Hub-authored in `skills/`; 34-ID-E Laue indexing, calibration inputs, coordinate conventions, results, and a batch example. Execution requires upstream's supported Linux environment.                                      |
| `apexa-report`                                    | Imported unchanged from APEXA's `.agents/skills/apexa-report`; self-contained run reports and experiment logbooks. Requires APEXA's report/logbook tools and run manifests. Repository license retained.                    |
| `aps-2idd-control-suite`                          | Hub-authored in `skills/`; APS 2-ID-D FastMCP/QueueServer setup, health and image-processing contracts, units, and scan semantics. Upstream has no packaged skill or applicable license declaration at the reviewed commit. |
| `aps-gsas-ii-powder-refinement`                   | Hub-authored in `skills/`; direct GSASIIscriptable import, staged Rietveld analysis, result interpretation, and a project-preparation example. Requires a working GSAS-II installation and experiment-specific inputs.      |

`browser-use` is imported unchanged from `browser-use/browser-use` at `browser_use/skills/browser-use`, the source linked by [the requested SkillsMP entry](https://skillsmp.com/creators/browser-use/browser-use/browser-use-skills-browser-use). Its MIT license is included. The skill documents the separate Browser Use/CDP runtime; installation of the skill alone does not install that runtime.

The authored packages link to pinned upstream documentation and identify local authorship explicitly. Their example scripts have been syntax/CLI checked; representative agent tasks and beamline execution are deferred.

`npm run import:catalog` is repeatable: it skips matching imported commits and unchanged local packages/metadata, and publishes changed local packages as new revisions. Explicit `directory` entries support skills outside `skills/<name>`. Add `-- --archive-examples` to hide the original six demos after publication succeeds; their revisions are retained. Starter entries belong to the credential-free **APS curated library** account and can be maintained by a hub administrator. Edit original packages under `skills/` and rerun the command to republish them; their upstream-reference commits are in each package. `npm run seed` remains available for a separate demo database.

To import your own selection, sign in, open **Upload → Import from GitHub**, find the repository's skills, select a directory, preview, classify, and publish. **Manage skill → Refresh from GitHub** checks the tracked branch/tag and creates an immutable revision if the commit changed; a commit-pinned ref stays pinned. Metadata edits retain source attribution. Modified upstream files should be published as a separate upload. Upstream publisher and local maintainer are displayed separately.

Imports preserve source bytes and executable flags, verify Git blob hashes, and include ancestor license/notice files under `_upstream/`. Per-skill license declarations are displayed verbatim alongside included terms; they can describe underlying libraries rather than the repository's own license. The selected Anthropic packages contain Apache-2.0 terms; K-Dense's repository license is MIT. Packages are reviewed starting points, not beamline-validated procedures; dependency requirements remain in their instructions. The importer never executes scripts.

Initial package smoke checks exercised downloaded CSV profiling, HDF5 hierarchy/dtype/shape inspection, and palette contrast auditing on synthetic inputs with Python 3.11 (plus h5py 3.16 for HDF5). These checks cover those bundled tools, not every workflow or agent's skill-selection behavior.

Only public HTTPS GitHub repositories are supported initially. Links, submodules, Git LFS pointers, incomplete repository trees, and oversized packages are rejected. An optional server-side `GITHUB_TOKEN` increases GitHub's API quota; it is sent only to `api.github.com`, never to browsers or raw-file hosts. No token is needed for browsing or downloading the local library.

The **Use this skill** card links to an imported skill's GitHub directory. For local contributions, `metadata.source-repository` in the package frontmatter supplies a related GitHub project link, explicitly separate from import provenance. Installation always targets the selected hub revision's complete ZIP. Command options use `skills@1.7.4` (Node.js 22.20+) through npx, bunx, or pnpm dlx; prompt instructions live at `/skill-install/prompt.md`. The installing environment needs access to the hub, plus the npm registry for commands. The CLI is not an application dependency.

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
python3 -m unittest discover -s tests -p '*_test.py'
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Tests use isolated temporary databases. Backend tests cover import boundaries, integrity, licenses, branch resolution, and immutable provenance using mocked upstream responses. Browser tests cover publishing, anonymous discovery/downloads, cross-account edit/refresh attempts, CSRF rejection, revisions, archival, password changes, mobile layouts, and automated accessibility checks. Screenshots are written to `test-results/`. Use `npm run format` before committing.

Use Conventional Commit titles for commits, PRs, and squash merges, such as `feat(catalog): add skill imports` or `fix(auth): invalidate recovered sessions`. Keep changes focused, code straightforward, and documentation here unless a concrete need warrants another document. UI clarity and accessibility are acceptance criteria, not a final polish step.

## Deploy on arecibo

The deployment configuration in `deploy/` targets **https://arecibo.xray.aps.anl.gov:9005** on RHEL 9.8. It runs as `haskels` using persistent systemd user services (linger enabled), with no root privileges:

- Node.js **24.22.1** serves the application on `127.0.0.1:19005`.
- Caddy **2.11.7** terminates HTTPS on port 9005 using the existing JMD InCommon certificate and key under `~/.jmd/tls/`. The certificate covers `arecibo.xray.aps.anl.gov`; the reviewed certificate expires January 9, 2027.
- `deploy/Caddyfile` restricts every route to loopback, `10.0.0.0/8`, and `164.54.0.0/16`, matching the approved CAI network policy. It checks the socket peer address, not a client-supplied forwarded header. Caddy overwrites `X-Forwarded-For`; only its loopback backend can reach Node, which trusts one proxy hop for authentication throttling.
- Runtime binaries, releases, the database, and immutable packages live on local XFS under `/local/haskels/skills-hub`. The user's home is NFS and holds service definitions, the existing certificate, and backups. SQLite's live database must remain on local storage.

Layout:

```text
/local/haskels/skills-hub/
  runtime/node/       # official Node distribution (symlink to versioned directory)
  runtime/caddy       # official Caddy binary
  source/             # Git checkout used to create release worktrees
  releases/<commit>/  # isolated source, dependencies, and build for each deployment
  current -> releases/<commit>
  data/               # hub.sqlite, packages/, and import cache
~/.skills-hub/backups/ # private compressed snapshots on NFS
```

Verify official runtime archive checksums before installation: Node publishes SHA-256 sums; Caddy publishes SHA-512 sums. The local filesystem had approximately 16 GB free during setup; monitor usage and retain only needed release builds and import caches.

### Publish and activate a release

Push changes and wait for the GitHub **Checks** workflow. Create an annotated version tag after checks pass. On arecibo, resolve that tag to a commit, create a fresh release worktree, then build and import its catalog using the local Node runtime:

```sh
export PATH=/local/haskels/skills-hub/runtime/node/bin:$PATH
export DATA_DIR=/local/haskels/skills-hub/data
# Run in the new releases/<commit> worktree:
npm ci
npm run check
npm test
python3 -m unittest discover -s tests -p '*_test.py'
npm run build
npm run import:catalog
```

For the first deployment, create `current` pointing at that worktree. Install `deploy/skills-hub*.service` and `deploy/skills-hub-backup.timer` in `~/.config/systemd/user/`, run `systemctl --user daemon-reload`, then enable/start `skills-hub.service`, `skills-hub-tls.service`, and `skills-hub-backup.timer`. Validate the Caddy configuration with `runtime/caddy validate --config current/deploy/Caddyfile --adapter caddyfile` before starting HTTPS.

For updates, take a backup first, build the new release separately, replace the `current` symlink atomically, and restart `skills-hub`. Reload systemd definitions if they changed; restart `skills-hub-tls` when changing its configuration or renewing the shared certificate. The application `ORIGIN` must match the externally visible HTTPS origin. `deploy/skills-hub.service` specifies the production environment explicitly.

Verify HTTPS certificate trust, the catalog, API docs, a revision-pinned download, and anonymous access after activation. New deployments have a credential-free curated owner and no personal accounts; create your own account through the site and run `DATA_DIR=/local/haskels/skills-hub/data npm run admin -- promote <username>` from the release when assigning an administrator.

```sh
systemctl --user status skills-hub skills-hub-tls skills-hub-backup.timer
journalctl --user -u skills-hub -u skills-hub-tls --since today
systemctl --user start skills-hub-backup.service
```

### Backups and rollback

The backup timer runs daily at 03:30 host time (plus up to 15 minutes of jitter) and catches up after downtime. `deploy/backup.py` takes an online SQLite snapshot on local disk, checks it, and archives exactly the immutable package files referenced by that snapshot. It records the deployed Git commit, preserves executable modes, publishes the archive atomically on NFS, and retains 14 successful snapshots. An incomplete backup does not replace the preceding one. Archives contain account data and are private to the deployment user.

To verify or restore, extract a trusted archive into a **new, empty** local directory; check SQLite integrity and the package manifest hashes there. Stop `skills-hub` before switching its live `data/` directory to a restored copy. Preserve the old directory until the restored application has been verified. A snapshot includes the database and packages, not TLS keys or rebuildable GitHub caches.

For a code-only rollback, switch `current` to the preceding release and restart the application. If an update changes the database schema incompatibly, restore the matching pre-update snapshot as well; changing code alone does not undo a schema migration.

For another host or a subpath deployment, adapt these host-specific service/proxy files. Set `BASE_PATH` at build time and append it to user-facing links, not `ORIGIN`; `.env.example` lists the general application settings.
