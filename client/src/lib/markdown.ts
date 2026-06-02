import { browser } from '$app/environment';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }) {
	const langClass = lang ? ` class="language-${lang.replace(/[^a-zA-Z0-9_-]/g, '')}"` : '';
	return `<pre><code${langClass}>${escapeHtml(text)}</code></pre>`;
};

marked.use({ gfm: true, breaks: true, renderer });

const ALLOWED_TAGS = [
	'p',
	'br',
	'strong',
	'em',
	'code',
	'pre',
	'ul',
	'ol',
	'li',
	'blockquote',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'a',
	'hr',
	'del',
	'span'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'title'];

let hookInstalled = false;

export function renderMarkdown(text: string): string {
	if (!browser) return text;
	if (!hookInstalled) {
		DOMPurify.addHook('afterSanitizeAttributes', (node) => {
			if (node.tagName === 'A') {
				node.setAttribute('target', '_blank');
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
		hookInstalled = true;
	}
	const html = marked.parse(text, { async: false }) as string;
	return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
