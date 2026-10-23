import { createHash } from 'node:crypto';
import { fromBuffer } from 'yauzl';
import { parse } from 'yaml';
import { HubError } from './errors';

export const maxUpload = 10 * 1024 * 1024;
const maxExpanded = 25 * 1024 * 1024;
const maxFile = 5 * 1024 * 1024;
export type PackageFile = { path: string; data: Buffer; mode: number };
export type SkillPackage = {
	name: string;
	description: string;
	license: string;
	compatibility: string;
	version: string;
	content: string;
	files: PackageFile[];
};
export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

export function safePath(path: string) {
	return (
		path.length <= 240 &&
		!/[\\\x00-\x1f:]/.test(path) &&
		!path.startsWith('/') &&
		path.split('/').every((part) => part && part !== '.' && part !== '..')
	);
}

function readZip(buffer: Buffer): Promise<PackageFile[]> {
	return new Promise((resolve, reject) => {
		fromBuffer(
			buffer,
			{ lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
			(err, zip) => {
				if (err || !zip) return reject(new HubError('Unable to read this ZIP archive.'));
				const files: PackageFile[] = [];
				let expanded = 0;
				let entries = 0;
				let failed = false;
				const fail = (message: string) => {
					failed = true;
					zip.close();
					reject(new HubError(message));
				};
				zip.on('error', () => fail('The ZIP archive is invalid or incomplete.'));
				zip.on('entry', (entry) => {
					const path = entry.fileName.replace(/\/$/, '');
					const mode = entry.externalFileAttributes >>> 16;
					if (
						++entries > 250 ||
						!safePath(path) ||
						(mode & 0xf000) === 0xa000 ||
						entry.generalPurposeBitFlag & 1
					) {
						return fail('ZIP contains unsupported paths, links, encryption, or too many entries.');
					}
					if (entry.fileName.endsWith('/')) return zip.readEntry();
					if (files.some((file) => file.path === path))
						return fail('ZIP contains duplicate file paths.');
					expanded += entry.uncompressedSize;
					if (entry.uncompressedSize > maxFile || expanded > maxExpanded || files.length >= 200)
						return fail('Use at most 200 files, 5 MB per file, and 25 MB expanded.');
					zip.openReadStream(entry, (error, stream) => {
						if (error || !stream) return fail('Unable to read a file in this ZIP.');
						const chunks: Buffer[] = [];
						let size = 0;
						stream.on('data', (chunk: Buffer) => {
							size += chunk.length;
							if (size > entry.uncompressedSize || size > maxFile) {
								stream.destroy();
								fail('Expanded file exceeds its size limit.');
							} else chunks.push(chunk);
						});
						stream.on('error', () => fail('The ZIP archive is invalid or incomplete.'));
						stream.on('end', () => {
							if (failed) return;
							files.push({ path, data: Buffer.concat(chunks), mode: mode & 0o111 ? 0o755 : 0o644 });
							zip.readEntry();
						});
					});
				});
				zip.on('end', () => {
					if (!failed) resolve(files);
				});
				zip.readEntry();
			}
		);
	});
}

export function validatePackage(files: PackageFile[]): SkillPackage {
	if (!files.length || files.length > 200) throw new HubError('Provide a skill with 1–200 files.');
	if (
		files.some((f) => !safePath(f.path) || f.data.length > maxFile) ||
		files.reduce((sum, f) => sum + f.data.length, 0) > maxExpanded
	)
		throw new HubError('The package exceeds the file limits or contains an invalid path.');
	const root = files.find((f) => f.path === 'SKILL.md');
	const candidates = files.filter((f) => /^[^/]+\/SKILL\.md$/.test(f.path));
	const main = root ?? (candidates.length === 1 ? candidates[0] : undefined);
	if (!main)
		throw new HubError(
			'Include SKILL.md at the root, or inside a single skill folder. Upload one skill at a time.'
		);
	const prefix = main.path.slice(0, -'SKILL.md'.length);
	if (prefix && files.some((f) => !f.path.startsWith(prefix)))
		throw new HubError('All files must be inside the skill folder.');
	files = files
		.map((f) => ({ ...f, path: f.path.slice(prefix.length) }))
		.sort((a, b) => a.path.localeCompare(b.path));
	if (new Set(files.map((f) => f.path)).size !== files.length)
		throw new HubError('Duplicate package paths.');
	if (files.some((f) => files.some((other) => other.path.startsWith(f.path + '/'))))
		throw new HubError('A file conflicts with a directory path.');
	const content = main.data.toString('utf8');
	const match = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match || match[1].length > 16384)
		throw new HubError('SKILL.md needs YAML frontmatter containing name and description.');
	let meta: Record<string, unknown>;
	try {
		meta = parse(match[1], { maxAliasCount: 0, uniqueKeys: true });
		if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error();
	} catch {
		throw new HubError('SKILL.md contains invalid YAML frontmatter.');
	}
	const name = typeof meta.name === 'string' ? meta.name : '';
	const description = typeof meta.description === 'string' ? meta.description.trim() : '';
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64)
		throw new HubError(
			'Skill name must use lowercase letters, numbers, and single hyphens (up to 64 characters).'
		);
	if (prefix && prefix.slice(0, -1) !== name)
		throw new HubError('The skill folder name must match the name in SKILL.md.');
	if (!description || description.length > 1024)
		throw new HubError('Provide a description of 1–1,024 characters in SKILL.md.');
	const textField = (key: string, max: number) => {
		if (meta[key] === undefined) return '';
		if (typeof meta[key] !== 'string' || (meta[key] as string).length > max)
			throw new HubError(`${key} must be text of ${max} characters or fewer.`);
		return meta[key] as string;
	};
	const metadata = meta.metadata as Record<string, unknown> | undefined;
	const version =
		metadata && typeof metadata.version === 'string' ? metadata.version.slice(0, 80) : '';
	return {
		name,
		description,
		license: textField('license', 500),
		compatibility: textField('compatibility', 500),
		version,
		content,
		files
	};
}

export async function parseUpload(file: File): Promise<SkillPackage> {
	if (!file.size || file.size > maxUpload)
		throw new HubError('Choose a SKILL.md or ZIP file up to 10 MB.');
	const buffer = Buffer.from(await file.arrayBuffer());
	if (file.name.toLowerCase().endsWith('.zip')) return validatePackage(await readZip(buffer));
	if (file.name !== 'SKILL.md')
		throw new HubError('Upload SKILL.md or a ZIP containing a skill folder.');
	return validatePackage([{ path: 'SKILL.md', data: buffer, mode: 0o644 }]);
}
