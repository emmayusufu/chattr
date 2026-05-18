<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { basicSetup } from 'codemirror';
	import { markdown } from '@codemirror/lang-markdown';
	import { languages } from '@codemirror/language-data';
	import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
	import { syntaxHighlighting } from '@codemirror/language';
	import * as Y from 'yjs';
	import { Awareness } from 'y-protocols/awareness';
	import { yCollab } from 'y-codemirror.next';
	import type { RoomClient } from './RoomClient';

	export let room: RoomClient;

	let editorEl: HTMLDivElement;
	let view: EditorView | null = null;
	let ydoc: Y.Doc | null = null;
	let awareness: Awareness | null = null;
	let detach: (() => void) | null = null;
	let status: 'syncing' | 'live' | 'offline' = 'syncing';

	const cursorColors = ['#e98c3a', '#5fa8d3', '#8fbf6a', '#d97ab5', '#c08fee', '#e8c14a'];

	function colorForName(name: string): string {
		let h = 0;
		for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
		return cursorColors[Math.abs(h) % cursorColors.length];
	}

	onMount(async () => {
		ydoc = new Y.Doc();
		awareness = new Awareness(ydoc);
		awareness.setLocalStateField('user', {
			name: room.name,
			color: colorForName(room.name),
			colorLight: colorForName(room.name) + '33'
		});
		const ytext = ydoc.getText('scratchpad');

		try {
			detach = await room.attachScratchpad(ydoc, awareness);
			status = 'live';
		} catch {
			status = 'offline';
		}

		const chattrTheme = EditorView.theme(
			{
				'&': {
					height: '100%',
					fontSize: '0.85rem',
					backgroundColor: 'var(--surface)',
					color: 'var(--text)'
				},
				'.cm-scroller': {
					fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
					lineHeight: '1.5'
				},
				'.cm-content': {
					caretColor: 'var(--accent)'
				},
				'.cm-gutters': {
					backgroundColor: 'var(--surface)',
					color: 'var(--text-faint)',
					border: 'none'
				},
				'.cm-activeLine': { backgroundColor: 'transparent' },
				'.cm-activeLineGutter': { backgroundColor: 'transparent' },
				'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
				'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
					backgroundColor: 'rgba(244, 237, 228, 0.28)'
				},
				'.cm-content ::selection': {
					backgroundColor: 'rgba(244, 237, 228, 0.28)',
					color: 'var(--text)'
				}
			},
			{ dark: true }
		);

		view = new EditorView({
			parent: editorEl,
			state: EditorState.create({
				doc: ytext.toString(),
				extensions: [
					basicSetup,
					markdown({ codeLanguages: languages }),
					syntaxHighlighting(oneDarkHighlightStyle),
					keymap.of([indentWithTab]),
					chattrTheme,
					EditorView.lineWrapping,
					yCollab(ytext, awareness)
				]
			})
		});
	});

	onDestroy(() => {
		detach?.();
		view?.destroy();
		awareness?.destroy();
		ydoc?.destroy();
	});

	function statusLabel(s: typeof status): string {
		if (s === 'syncing') return 'syncing…';
		if (s === 'offline') return 'offline';
		return 'live';
	}
</script>

<div class="scratchpad">
	<div class="status" class:offline={status === 'offline'}>{statusLabel(status)}</div>
	<div class="editor" bind:this={editorEl} />
</div>

<style>
	.scratchpad {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.status {
		padding: 0.35rem 0.85rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-faint);
		border-bottom: 1px solid var(--border);
		background: transparent;
	}

	.status.offline {
		color: var(--danger, #d16464);
	}

	.editor {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.editor :global(.cm-editor) {
		height: 100%;
		outline: none;
	}

	.editor :global(.cm-editor.cm-focused) {
		outline: none;
	}
</style>
