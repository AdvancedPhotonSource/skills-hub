import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { base } from '$app/paths';
import { parseUpload, validatePackage } from './packages';
import {
	classification,
	publish,
	requireOwner,
	revisionFor,
	readPackageFile,
	setArchived
} from './catalog';
import { formError } from './forms';
import { renderMarkdown } from './markdown';
import { HubError } from './errors';
import { allowAttempt } from './auth';
import { inspectRepository, importDirectory } from './github';

export const editorActions = {
	discover: async ({ request, locals }: RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		if (!allowAttempt(`import:${locals.user.id}`, 30, 3600000))
			return fail(429, { message: 'Import limit reached. Try again in an hour.' });
		try {
			const form = await request.formData();
			const snapshot = await inspectRepository(
				String(form.get('repository') || ''),
				String(form.get('ref') || '')
			);
			return {
				repository: {
					url: `https://github.com/${snapshot.repository}`,
					ref: snapshot.ref,
					commit: snapshot.commit,
					directory: snapshot.directory,
					directories: snapshot.directories
				}
			};
		} catch (error) {
			return formError(error);
		}
	},
	preview: async ({ request, locals, params }: RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		try {
			if (params.id) requireOwner(params.id, locals.user);
			const form = await request.formData();
			if (form.get('method') === 'github' && !allowAttempt(`import:${locals.user.id}`, 30, 3600000))
				return fail(429, { message: 'Import limit reached. Try again in an hour.' });
			const pkg = await packageFromForm(form, params.id);
			return {
				preview: {
					name: pkg.name,
					description: pkg.description,
					files: pkg.files.map((f) => ({ path: f.path, size: f.data.length })),
					html: renderMarkdown(pkg.content.slice(0, 100000)),
					source: pkg.source
				}
			};
		} catch (error) {
			return formError(error);
		}
	},
	publish: async ({ request, locals, params }: RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		if (!allowAttempt(`publish:${locals.user.id}`, 30, 3600000))
			return fail(429, { message: 'Publication limit reached. Try again in an hour.' });
		let id;
		try {
			if (params.id) requireOwner(params.id, locals.user);
			const form = await request.formData();
			const pkg = await packageFromForm(form, params.id);
			id = publish(
				locals.user,
				pkg,
				classification(form),
				params.id ? { id: params.id, expected: Number(form.get('expected')) } : undefined
			);
		} catch (error) {
			return formError(error);
		}
		redirect(303, `${base}/skills/${id}`);
	},
	refresh: async ({ request, locals, params }: RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		try {
			if (!params.id) throw new HubError('Skill not found.', 404);
			const skill = requireOwner(params.id, locals.user);
			if (!skill.source) throw new HubError('This skill was uploaded locally.');
			const form = await request.formData();
			if (Number(form.get('expected')) !== skill.revision)
				throw new HubError('This skill changed. Reload before refreshing.', 409);
			if (!allowAttempt(`import:${locals.user.id}`, 30, 3600000))
				return fail(429, { message: 'Import limit reached. Try again in an hour.' });
			const snapshot = await inspectRepository(
				`https://github.com/${skill.source.repository}`,
				skill.source.ref
			);
			if (snapshot.commit === skill.source.commit)
				return { message: 'Already at the latest source revision.', success: true };
			const pkg = await importDirectory(snapshot, skill.source.directory);
			publish(locals.user, pkg, skill, { id: skill.id, expected: skill.revision });
		} catch (error) {
			return formError(error);
		}
		redirect(303, `${base}/skills/${params.id}`);
	},
	archive: async ({ request, locals, params }: RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		try {
			if (!params.id) throw new HubError('Skill not found.', 404);
			const form = await request.formData();
			setArchived(
				params.id,
				locals.user,
				form.get('archived') === '1',
				Number(form.get('expected'))
			);
		} catch (error) {
			return formError(error);
		}
		redirect(303, `${base}/my-skills`);
	}
};

async function packageFromForm(form: FormData, id?: string) {
	const current = id ? revisionFor(id) : null;
	if (form.get('method') === 'github') {
		if (id) throw new HubError('Use Refresh from GitHub to update this import.');
		const commit = String(form.get('commit') || '');
		if (!/^[a-f0-9]{40}$/.test(commit))
			throw new HubError('Find skills in the repository before importing.');
		const snapshot = await inspectRepository(String(form.get('repository') || ''), commit);
		const directory = String(form.get('directory') || '');
		return importDirectory(
			snapshot,
			directory === '.' ? '' : directory,
			String(form.get('ref') || commit)
		);
	}
	const file = form.get('file');
	if (file instanceof File && file.size) {
		if (current?.source)
			throw new HubError(
				'Imported files are refreshed from GitHub. Publish modified files as a separate skill.'
			);
		return parseUpload(file);
	}
	if (!current) throw new HubError('Choose a SKILL.md or ZIP file.');
	const pkg = validatePackage(
		current.files.map((f) => ({
			path: f.path,
			data: readPackageFile(current, f.path),
			mode: (f as typeof f & { mode?: number }).mode || 0o644
		}))
	);
	if (current.source) pkg.source = current.source;
	return pkg;
}
