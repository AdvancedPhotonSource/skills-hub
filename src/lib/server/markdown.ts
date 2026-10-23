import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(
	source: string,
	context?: { path: string; revision: number; files: { path: string }[] }
) {
	const body = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
	return sanitizeHtml(marked.parse(body, { async: false }) as string, {
		allowedTags: [...sanitizeHtml.defaults.allowedTags, 'details', 'summary'],
		allowedAttributes: {
			a: ['href', 'title', 'rel'],
			code: ['class'],
			pre: ['tabindex', 'role', 'aria-label']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false,
		transformTags: {
			pre: () => ({
				tagName: 'pre',
				attribs: { tabindex: '0', role: 'region', 'aria-label': 'Code example' }
			}),
			a: (tagName, attributes) => {
				let href = attributes.href || '';
				if (context && href && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) {
					try {
						const target = new URL(href, `https://package.invalid/${context.path}`);
						const path = decodeURIComponent(target.pathname.slice(1));
						if (context.files.some((file) => file.path === path))
							href = `?${new URLSearchParams({ revision: String(context.revision), file: path })}${target.hash}`;
					} catch {
						href = '';
					}
				}
				return { tagName, attribs: { ...attributes, href, rel: 'noreferrer noopener' } };
			}
		}
	});
}
