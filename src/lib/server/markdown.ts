import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(source: string) {
	const body = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
	return sanitizeHtml(marked.parse(body, { async: false }) as string, {
		allowedTags: [...sanitizeHtml.defaults.allowedTags, 'details', 'summary'],
		allowedAttributes: { a: ['href', 'title', 'rel'], code: ['class'] },
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false,
		transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noreferrer noopener' }) }
	});
}
