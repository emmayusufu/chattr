<slot />

<style>
	@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@450..700&display=swap');

	:global(:root) {
		--bg: #0a0807;
		--bg-deep: #050403;
		--surface: #14100c;
		--surface-2: #1c1813;
		--surface-3: #25201a;
		--border: rgba(244, 237, 228, 0.08);
		--border-strong: rgba(244, 237, 228, 0.16);
		--text: #f4ede4;
		--text-muted: #8a8076;
		--text-faint: #4f4940;
		--accent: #e98c3a;
		--accent-soft: rgba(233, 140, 58, 0.14);
		--accent-glow: rgba(233, 140, 58, 0.45);
		--danger: #d16464;

		--font: 'Fredoka', -apple-system, BlinkMacSystemFont, sans-serif;
	}

	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
	}

	:global(html),
	:global(body) {
		height: 100%;
		margin: 0;
		padding: 0;
		background: var(--bg);
		color: var(--text);
		font-family: var(--font);
		font-weight: 450;
		font-size: 14px;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	:global(body) {
		background: var(--bg);
		min-height: 100vh;
	}

	:global(body::before) {
		content: '';
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 999;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.96  0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/></svg>");
		opacity: 0.05;
		mix-blend-mode: overlay;
	}

	:global(#svelte) {
		height: 100%;
	}

	:global(button) {
		font-family: inherit;
		color: inherit;
		cursor: pointer;
	}

	:global(input),
	:global(textarea) {
		font-family: inherit;
		color: inherit;
		background: transparent;
	}

	:global(input:focus),
	:global(textarea:focus),
	:global(button:focus-visible) {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}

	:global(::selection) {
		background: var(--accent);
		color: var(--bg);
	}

	:global(::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}

	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(::-webkit-scrollbar-thumb) {
		background: var(--border-strong);
		border-radius: 4px;
	}

	:global(::-webkit-scrollbar-thumb:hover) {
		background: var(--text-faint);
	}
</style>
