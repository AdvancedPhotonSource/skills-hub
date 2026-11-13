import type { TokenizerAndRendererExtension, Tokens } from 'marked';

function mathToken(source: string, block: boolean) {
	const indent = block ? source.match(/^ {0,3}/)![0].length : 0;
	const text = source.slice(indent);
	const open = ['$$', '\\[', '\\(', '$'].find((delimiter) => text.startsWith(delimiter));
	if (!open) return;
	const display = open === '$$' || open === '\\[';
	if (block && !display) return;
	const close = open === '\\[' ? '\\]' : open === '\\(' ? '\\)' : open;
	for (let end = text.indexOf(close, open.length); end >= 0; end = text.indexOf(close, end + 1)) {
		let slashes = 0;
		for (let i = end - 1; i >= 0 && text[i] === '\\'; i--) slashes++;
		if (slashes % 2 || (open === '$' && text[end + 1] === '$')) continue;
		const math = text.slice(open.length, end);
		if (!math.trim() || (!display && /\n/.test(math))) return;
		const length = indent + end + close.length;
		const ending = block ? source.slice(length).match(/^[ \t]*(?:\n|$)/) : null;
		if (block && !ending) return;
		return {
			type: block ? 'blockMath' : 'inlineMath',
			raw: source.slice(0, length + (ending?.[0].length || 0)),
			math,
			display
		};
	}
}

function renderMath(token: Tokens.Generic) {
	const math = String(token.math)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
	if (!token.display) return `<span class="math-inline">\\(${math}\\)</span>`;
	const tag = token.type === 'blockMath' ? 'div' : 'span';
	return `<${tag} class="math-display">\\[${math}\\]</${tag}>`;
}

export const mathExtensions: TokenizerAndRendererExtension[] = [
	{
		name: 'blockMath',
		level: 'block',
		start: (source) => source.match(/(?:^|\n) {0,3}(?:\$\$|\\\[)/)?.index,
		tokenizer: (source) => mathToken(source, true),
		renderer: renderMath
	},
	{
		name: 'inlineMath',
		level: 'inline',
		start: (source) => source.match(/\\[([]|\$/)?.index,
		tokenizer: (source) => mathToken(source, false),
		renderer: renderMath
	}
];
