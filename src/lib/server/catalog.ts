import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { zipSync } from 'fflate';
import { db, dataDir } from './db';
import { categories, roles } from '../taxonomy';
import { HubError } from './errors';
import { sha256, type SkillPackage } from './packages';
import type { Skill, Revision, User } from '../types';

type SkillRow = Omit<Skill, 'categories' | 'tags' | 'archived'> & {
	categories: string;
	tags: string;
	archived: number;
};
const select = `SELECT s.id, s.owner_id AS ownerId, s.name, s.description, s.categories, s.tags, s.role,
  s.license, s.compatibility, s.updated_at AS updatedAt, s.revision, s.downloads, s.archived,
  u.username, u.display_name AS displayName FROM skills s JOIN users u ON u.id = s.owner_id`;
const toSkill = (row: SkillRow): Skill => ({
	...row,
	categories: JSON.parse(row.categories),
	tags: JSON.parse(row.tags),
	archived: Boolean(row.archived)
});

export function getSkill(id: string, owner?: User | null) {
	const row = db.prepare(`${select} WHERE s.id = ?`).get(id) as SkillRow | undefined;
	if (!row || (row.archived && row.ownerId !== owner?.id && !owner?.isAdmin))
		throw new HubError('Skill not found.', 404);
	return toSkill(row);
}

export function requireOwner(id: string, user: User | null) {
	if (!user) throw new HubError('Sign in to manage this skill.', 401);
	const skill = getSkill(id, user);
	if (skill.ownerId !== user.id && !user.isAdmin)
		throw new HubError('Only the owner can modify this skill.', 403);
	return skill;
}

export function searchSkills(params: URLSearchParams, owner?: User) {
	const query = (params.get('q') || '').trim().slice(0, 200);
	const category = params.get('category') || '';
	const role = params.get('role') || '';
	const tag = params.get('tag') || '';
	const author = params.get('author') || '';
	const sort = params.get('sort') || 'relevance';
	const exact = params.get('exact') === '1';
	const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1)) | 0;
	const limit = 20;
	const where = [owner ? 's.owner_id = ?' : 's.archived = 0'];
	const values: (string | number)[] = owner ? [owner.id] : [];
	if (query) {
		if (exact) {
			where.push('s.name = ?');
			values.push(query);
		} else {
			const terms = query.match(/"[^"]+"|[\p{L}\p{N}_-]+/gu) || [];
			if (!terms.length) where.push('0');
			else {
				const fts = terms.map((t) => (t.startsWith('"') ? t : `"${t}"*`)).join(' AND ');
				where.push('s.id IN (SELECT skill_id FROM skill_search WHERE skill_search MATCH ?)');
				values.push(fts);
			}
		}
	}
	if (category) {
		const ids = [category, ...categories.filter((c) => c.parent === category).map((c) => c.id)];
		where.push(
			`EXISTS (SELECT 1 FROM json_each(s.categories) WHERE value IN (${ids.map(() => '?').join(',')}))`
		);
		values.push(...ids);
	}
	if (role) {
		where.push('s.role = ?');
		values.push(role);
	}
	if (tag) {
		where.push('EXISTS (SELECT 1 FROM json_each(s.tags) WHERE value = ?)');
		values.push(tag);
	}
	if (author) {
		where.push('u.username = ?');
		values.push(author);
	}
	const days = Number(params.get('days'));
	if ([7, 30, 90, 365].includes(days)) {
		where.push('s.updated_at >= ?');
		values.push(new Date(Date.now() - days * 86400000).toISOString());
	}
	const clause = where.join(' AND ');
	const total = (
		db
			.prepare(
				`SELECT count(*) AS n FROM skills s JOIN users u ON u.id = s.owner_id WHERE ${clause}`
			)
			.get(...values) as { n: number }
	).n;
	let order = sort === 'downloads' ? 's.downloads DESC, s.updated_at DESC' : 's.updated_at DESC';
	const orderValues: string[] = [];
	if (query && !exact && sort === 'relevance') {
		const terms = query.match(/"[^"]+"|[\p{L}\p{N}_-]+/gu) || [];
		if (terms.length) {
			order = `(SELECT bm25(skill_search, 0, 10, 5, 3, 1) FROM skill_search WHERE skill_search MATCH ? AND skill_id = s.id), s.updated_at DESC`;
			orderValues.push(terms.map((t) => (t.startsWith('"') ? t : `"${t}"*`)).join(' AND '));
		}
	}
	const skills = (
		db
			.prepare(`${select} WHERE ${clause} ORDER BY ${order}, s.id LIMIT ? OFFSET ?`)
			.all(...values, ...orderValues, limit, (page - 1) * limit) as SkillRow[]
	).map(toSkill);
	return { skills, total, page, pages: Math.ceil(total / limit), query };
}

export function taxonomyCounts() {
	const rows = db.prepare('SELECT categories FROM skills WHERE archived = 0').all() as {
		categories: string;
	}[];
	const assigned = rows.map((r) => new Set<string>(JSON.parse(r.categories)));
	return categories.map((category) => {
		const ids = [
			category.id,
			...categories.filter((c) => c.parent === category.id).map((c) => c.id)
		];
		return { ...category, count: assigned.filter((set) => ids.some((id) => set.has(id))).length };
	});
}

export function revisions(id: string): Revision[] {
	return (
		db
			.prepare(
				`SELECT id, number, created_at AS createdAt, checksum, version, name, description, license, compatibility, files FROM revisions WHERE skill_id = ? ORDER BY number DESC`
			)
			.all(id) as (Omit<Revision, 'files'> & { files: string })[]
	).map((r) => ({ ...r, files: JSON.parse(r.files) }));
}

export function revisionFor(id: string, number?: number) {
	const revision = revisions(id).find((r) => !number || r.number === number);
	if (!revision) throw new HubError('Revision not found.', 404);
	return revision;
}

export function readPackageFile(revision: Revision, path: string) {
	if (!revision.files.some((f) => f.path === path)) throw new HubError('File not found.', 404);
	return readFileSync(join(dataDir, 'packages', revision.id, path));
}

export type Classification = { categories: string[]; tags: string[]; role: string };
export function classification(form: FormData): Classification {
	const selected = [...new Set(form.getAll('category').map(String))];
	if (
		!selected.length ||
		selected.length > 5 ||
		selected.some((id) => !categories.some((c) => c.id === id))
	)
		throw new HubError('Choose between one and five categories.');
	const tags = [
		...new Set(
			String(form.get('tags') || '')
				.split(',')
				.map((t) => t.trim().toLowerCase())
				.filter(Boolean)
		)
	];
	if (tags.length > 10 || tags.some((t) => t.length > 32 || !/^[\p{L}\p{N} .+#_-]+$/u.test(t)))
		throw new HubError('Use up to 10 short, comma-separated technology tags.');
	const role = String(form.get('role') || '');
	if (role && !roles.includes(role)) throw new HubError('Choose an available role.');
	return { categories: selected, tags, role };
}

export function publish(
	user: User,
	pkg: SkillPackage,
	meta: Classification,
	update?: { id: string; expected: number }
) {
	const existing = update ? requireOwner(update.id, user) : null;
	if (existing && existing.name !== pkg.name)
		throw new HubError('Keep the existing skill name when publishing a revision.');
	const id = existing?.id || randomUUID();
	const revisionId = randomUUID();
	const number = (existing?.revision || 0) + 1;
	const now = new Date().toISOString();
	const files = pkg.files.map((f) => ({
		path: f.path,
		size: f.data.length,
		sha256: sha256(f.data),
		mode: f.mode
	}));
	const checksum = sha256(JSON.stringify(files));
	const folder = join(dataDir, 'packages', revisionId);
	try {
		for (const file of pkg.files) {
			const destination = join(folder, file.path);
			mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
			writeFileSync(destination, file.data, { mode: 0o600, flag: 'wx' });
		}
		db.transaction(() => {
			if (existing) {
				const result = db
					.prepare(
						`UPDATE skills SET description=?, categories=?, tags=?, role=?, license=?, compatibility=?, revision=?, updated_at=? WHERE id=? AND revision=?`
					)
					.run(
						pkg.description,
						JSON.stringify(meta.categories),
						JSON.stringify(meta.tags),
						meta.role,
						pkg.license,
						pkg.compatibility,
						number,
						now,
						id,
						update!.expected
					);
				if (!result.changes)
					throw new HubError(
						'This skill changed since you opened it. Reload before publishing.',
						409
					);
			} else {
				if (db.prepare('SELECT 1 FROM skills WHERE owner_id=? AND name=?').get(user.id, pkg.name))
					throw new HubError(
						'You already own a skill with this name. Open it to publish a new revision.',
						409
					);
				db.prepare(
					`INSERT INTO skills (id, owner_id, name, description, categories, tags, role, license, compatibility, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				).run(
					id,
					user.id,
					pkg.name,
					pkg.description,
					JSON.stringify(meta.categories),
					JSON.stringify(meta.tags),
					meta.role,
					pkg.license,
					pkg.compatibility,
					now
				);
			}
			db.prepare(
				'INSERT INTO revisions (id, skill_id, number, created_at, checksum, version, name, description, license, compatibility, files) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
			).run(
				revisionId,
				id,
				number,
				now,
				checksum,
				pkg.version,
				pkg.name,
				pkg.description,
				pkg.license,
				pkg.compatibility,
				JSON.stringify(files)
			);
			db.prepare('DELETE FROM skill_search WHERE skill_id=?').run(id);
			db.prepare(
				'INSERT INTO skill_search (skill_id, name, description, tags, content) VALUES (?, ?, ?, ?, ?)'
			).run(id, pkg.name, pkg.description, meta.tags.join(' '), pkg.content);
		})();
	} catch (error) {
		rmSync(folder, { recursive: true, force: true });
		throw error;
	}
	return id;
}

export function setArchived(id: string, user: User | null, archived: boolean, expected: number) {
	requireOwner(id, user);
	const result = db
		.prepare('UPDATE skills SET archived=? WHERE id=? AND revision=?')
		.run(Number(archived), id, expected);
	if (!result.changes) throw new HubError('This skill changed. Reload before archiving.', 409);
}

export function download(skill: Skill, revision: Revision) {
	const entries: Parameters<typeof zipSync>[0] = {};
	for (const file of revision.files) {
		const mode = (file as typeof file & { mode?: number }).mode || 0o644;
		entries[`${revision.name}/${file.path}`] = [
			readPackageFile(revision, file.path),
			{ os: 3, attrs: ((0o100000 | mode) << 16) >>> 0 }
		];
	}
	const zip = zipSync(entries);
	db.prepare('UPDATE skills SET downloads=downloads+1 WHERE id=?').run(skill.id);
	return zip;
}
