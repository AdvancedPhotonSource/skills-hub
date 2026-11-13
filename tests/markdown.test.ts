import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/lib/server/markdown';

describe('Markdown math', () => {
	it('preserves both inline delimiters and LaTeX syntax before Markdown processing', () => {
		const html = renderMarkdown(String.raw`Inline \(x_i+y_j\) and $\frac{a_1}{b_2}$ end.`);
		expect(html).toContain(String.raw`<span class="math-inline">\(x_i+y_j\)</span>`);
		expect(html).toContain(String.raw`<span class="math-inline">\(\frac{a_1}{b_2}\)</span>`);
		expect(html).not.toContain('<em>');
	});

	it.each([
		['\\[', '\\]'],
		['$$', '$$']
	])('preserves %s block math, including OSA alignment equations', (open, close) => {
		const equation = String.raw`M_1 = \frac{d_{\mathrm{inner}} + d_{\mathrm{outer}}}{2\sqrt{a_o b_o}}
      + \lambda\left(1-\frac{C_{\mathrm{inner}}+C_{\mathrm{outer}}}{2}\right).`;
		const html = renderMarkdown(`Before\n\n${open}\n${equation}\n${close}\n\nAfter`);
		expect(html).toContain(`<div class="math-display">\\[\n${equation}\n\\]</div>`);
		expect(html).toContain('<p>After</p>');
	});

	it('handles single-line display math, lists, and escaped dollar signs in math', () => {
		const html = renderMarkdown(String.raw`- $x_i$ and \(y_i\)

$$ x=1 $$

Cost: $\$5 + \$10$.`);
		expect(html).toContain('<li><span class="math-inline">');
		expect(html).toContain('<div class="math-display">\\[ x=1 \\]</div>');
		expect(html).toContain(String.raw`\(\$5 + \$10\)`);
	});

	it('leaves inline code, fenced code, escaped dollars, and unmatched delimiters alone', () => {
		const html = renderMarkdown(
			'`$x$` and `\\(y\\)`\n\n```tex\n$$ z $$\n\\[w\\]\n```\n\n\\$20 and \\$30. Unclosed $x and \\(y'
		);
		expect(html).not.toContain('class="math-');
		expect(html).toContain('<code>$x$</code>');
		expect(html).toContain('$$ z $$');
		expect(html).toContain('$20 and $30');
	});

	it('escapes HTML in math and retains Markdown sanitization and relative links', () => {
		const html = renderMarkdown(
			String.raw`$x < y & z > 0$ $<img src=x onerror=alert(1)>$

<script>alert(1)</script>
[Guide](notes.md) [Bad](javascript:alert(1))`,
			{
				path: 'SKILL.md',
				revision: 2,
				files: [{ path: 'notes.md' }]
			}
		);
		expect(html).toContain('x &lt; y &amp; z &gt; 0');
		expect(html).not.toMatch(/<script|<img|href="javascript:/);
		expect(html).toContain('?revision=2&amp;file=notes.md');
	});
});
