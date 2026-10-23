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

export const editorActions = {
	preview: async ({ request, locals, params }: RequestEvent) => {
		if (!locals.user) redirect(303, `${base}/sign-in`);
		try {
			if (params.id) requireOwner(params.id, locals.user);
			const form = await request.formData();
			const file = form.get('file');
			if (!(file instanceof File)) throw new HubError('Choose a file first.');
			const pkg = await parseUpload(file);
			return {
				preview: {
					name: pkg.name,
					description: pkg.description,
					files: pkg.files.map((f) => ({ path: f.path, size: f.data.length })),
					html: renderMarkdown(pkg.content.slice(0, 100000))
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
			const file = form.get('file');
			let pkg;
			if (file instanceof File && file.size) pkg = await parseUpload(file);
			else if (params.id) {
				const revision = revisionFor(params.id);
				pkg = validatePackage(
					revision.files.map((f) => ({
						path: f.path,
						data: readPackageFile(revision, f.path),
						mode: (f as typeof f & { mode?: number }).mode || 0o644
					}))
				);
			} else throw new HubError('Choose a SKILL.md or ZIP file.');
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
