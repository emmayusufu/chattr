import { browser } from '$app/environment';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const COPY_ICON_SVG =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

export const CHECK_ICON_SVG =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

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
	return `<pre><button type="button" class="copy-btn" data-copy-button aria-label="Copy code" title="Copy">${COPY_ICON_SVG}</button><code${langClass}>${escapeHtml(text)}</code></pre>`;
};

marked.use({ gfm: true, breaks: true, renderer });

const ALLOWED_TAGS = [
	'p', 'br', 'strong', 'em', 'code', 'pre',
	'ul', 'ol', 'li', 'blockquote',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'a', 'hr', 'del', 'span', 'button',
	'svg', 'path', 'rect', 'polyline'
];

const ALLOWED_ATTR = [
	'href', 'target', 'rel', 'class', 'title',
	'type', 'aria-label', 'aria-hidden', 'data-copy-button',
	'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
	'd', 'width', 'height', 'x', 'y', 'rx', 'ry', 'points'
];

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
