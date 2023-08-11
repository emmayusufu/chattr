<script lang="ts">
	export let roomId: string;
	export let nameInput: string;
	export let isSignedIn: boolean;
	export let onJoin: () => void;
	export let onSignIn: () => void;
</script>

<div class="lobby-shell">
	<header class="lobby-top">
		<a class="wordmark" href="/">chattr</a>
		<span class="lobby-eyebrow">live channel</span>
	</header>

	<div class="lobby-card">
		<div class="lobby-meta">
			<span class="meta-label">Frequency</span>
			<span class="meta-value">{roomId}</span>
		</div>

		<h1 class="lobby-title">
			Ready when <em>you are.</em>
		</h1>
		<p class="lobby-lede">Step up to the mic. Add your name and we'll patch you through.</p>

		<form class="lobby-form" on:submit|preventDefault={onJoin}>
			<label class="lobby-field">
				<span class="lobby-field-label">Your name</span>
				<input
					type="text"
					bind:value={nameInput}
					placeholder="—"
					readonly={isSignedIn}
					spellcheck="false"
				/>
			</label>
			<button type="submit" class="cta" disabled={!nameInput.trim()}>
				<span>Join now</span>
				<span class="cta-arrow">↗</span>
			</button>
		</form>

		{#if !isSignedIn}
			<div class="divider"><span>or</span></div>
			<button class="ghost-cta" on:click={onSignIn}>Sign in with Google</button>
		{/if}
	</div>

	<div class="lobby-foot">
		<span>↩ press enter to join</span>
	</div>
</div>

<style>
	.lobby-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem 2rem 3rem;
		animation: fade-up 0.7s ease;
	}

	@keyframes fade-up {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.lobby-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 2rem;
	}

	.wordmark {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
		transition: color 0.2s;
	}

	.wordmark:hover {
		color: var(--accent);
	}

	.lobby-eyebrow {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-faint);
	}

	.lobby-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 3rem 0;
	}

	.lobby-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 2.5rem;
		padding-left: 1rem;
		border-left: 2px solid var(--accent);
	}

	.meta-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-faint);
	}

	.meta-value {
		font-weight: 500;
		font-size: 1.05rem;
		color: var(--accent);
	}

	.lobby-title {
		font-size: clamp(2.5rem, 7vw, 4.25rem);
		line-height: 1;
		font-weight: 500;
		margin: 0 0 1.25rem;
	}

	.lobby-title em {
		font-style: normal;
		font-weight: 600;
		color: var(--accent);
	}

	.lobby-lede {
		font-size: 1rem;
		font-weight: 450;
		color: var(--text-muted);
		margin: 0 0 2.5rem;
		max-width: 38ch;
	}

	.lobby-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 480px;
	}

	.lobby-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-strong);
		transition: border-color 0.2s;
	}

	.lobby-field:focus-within {
		border-bottom-color: var(--accent);
	}

	.lobby-field-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-faint);
	}

	.lobby-field input {
		border: none;
		padding: 0;
		font-size: 1.4rem;
		font-weight: 500;
		color: var(--text);
		outline: none;
	}

	.lobby-field input:read-only {
		color: var(--accent);
	}

	.lobby-field input::placeholder {
		color: var(--text-faint);
	}

	.cta {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1.4rem;
		background: var(--accent);
		color: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 2px;
		font-weight: 600;
		font-size: 0.95rem;
		transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
		box-shadow: 0 0 0 0 var(--accent-glow);
	}

	.cta:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 28px -8px var(--accent-glow);
	}

	.cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.cta-arrow {
		font-size: 1.05rem;
		font-weight: 450;
		transition: transform 0.2s;
	}

	.cta:hover:not(:disabled) .cta-arrow {
		transform: translate(2px, -2px);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 2rem 0 1.25rem;
		max-width: 480px;
	}

	.divider span {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-faint);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.ghost-cta {
		align-self: flex-start;
		padding: 0.75rem 1.25rem;
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: 2px;
		font-size: 0.85rem;
		font-weight: 600;
		transition: border-color 0.2s, color 0.2s;
	}

	.ghost-cta:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.lobby-foot {
		display: flex;
		justify-content: flex-end;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-faint);
	}

	@media (max-width: 640px) {
		.lobby-shell {
			padding: 1rem 1.25rem 2rem;
		}

		.lobby-card {
			padding: 1.5rem 0;
		}

		.lobby-form {
			max-width: 100%;
		}

		.cta {
			align-self: stretch;
			justify-content: center;
		}
	}
</style>
