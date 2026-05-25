<script lang="ts">
	import {
		GoogleAuthProvider,
		onAuthStateChanged,
		signInWithPopup,
		type User
	} from 'firebase/auth';
	import { auth } from '../firebase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let isLoggedIn = false;
	let user: User;
	let loading = true;
	let error: string | null = null;
	let joinCode = '';
	let guestName = '';
	let guestMode = false;

	const signInWithGoogle = async () => {
		const provider = new GoogleAuthProvider();
		try {
			await signInWithPopup(auth, provider);
		} catch (err) {
			console.error('Error signing in with Google:', err);
			error = 'Failed to sign in with Google. Please try again later.';
		}
	};

	const newMeeting = () => {
		const id = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
		const keyBytes = crypto.getRandomValues(new Uint8Array(24));
		const key = btoa(String.fromCharCode(...keyBytes))
			.replaceAll('+', '-')
			.replaceAll('/', '_')
			.replaceAll('=', '');
		goto(`/${id}#k=${key}`);
	};

	const joinMeeting = () => {
		const value = joinCode.trim();
		if (!value) return;
		if (/^https?:\/\//i.test(value)) {
			try {
				const url = new URL(value);
				const code = url.pathname.replace(/^\//, '');
				if (code) goto(`/${code}${url.hash}`);
				return;
			} catch {
				// fall through
			}
		}
		goto(`/${value}`);
	};

	function enterAsGuest() {
		if (!guestName.trim()) return;
		sessionStorage.setItem('chattr-guest-name', guestName.trim());
		guestMode = true;
		isLoggedIn = true;
		loading = false;
	}

	onMount(() => {
		onAuthStateChanged(auth, (userData) => {
			try {
				isLoggedIn = !!userData;
				if (userData) {
					user = userData;
				}
			} catch (err) {
				console.error('Error during auth state change:', err);
				guestMode = true;
			} finally {
				loading = false;
			}
		});
	});
</script>

<main>
	{#if loading}
		<div class="screen-center">
			<span class="tuning"
				>Tuning in<span class="dots"><span>.</span><span>.</span><span>.</span></span></span
			>
		</div>
	{:else if isLoggedIn}
		<header class="topbar">
			<span class="wordmark">chattr</span>
			<div class="user-strip">
				<span class="live-pill">
					<span class="dot" />
					<span>on air</span>
				</span>
				<span class="user-name">{guestMode ? guestName : user.displayName}</span>
				<button class="ghost" on:click={() => auth.signOut()}>sign out</button>
			</div>
		</header>

		<section class="hero">
			<span class="eyebrow">est. tonight · ch. 01</span>
			<h1 class="display">
				<span>Real conversations,</span>
				<span class="accent">in real time.</span>
			</h1>
			<p class="lede">
				A place to meet, talk, and stay in tune. Pull up a chair and start broadcasting.
			</p>

			<div class="actions">
				<button class="cta" on:click={newMeeting}>
					<span class="cta-label">Start a new meeting</span>
					<span class="cta-arrow">↗</span>
				</button>

				<form class="join" on:submit|preventDefault={joinMeeting}>
					<label class="field">
						<span class="field-label">Have a code?</span>
						<input
							type="text"
							spellcheck="false"
							autocapitalize="off"
							autocomplete="off"
							placeholder="——————"
							bind:value={joinCode}
						/>
					</label>
					<button type="submit" class="join-btn" disabled={!joinCode.trim()}>Join</button>
				</form>
			</div>

			<div class="footnote">
				<span>↩ press enter</span>
				<span class="sep">·</span>
				<span>broadcasting since 2026</span>
			</div>
		</section>
	{:else}
		<div class="signin">
			<span class="signin-eyebrow">chattr broadcasting co.</span>
			<h1 class="display-xl">
				Tune <span class="accent">in.</span>
			</h1>
			<p class="signin-lede">
				A quiet place for loud conversations.<br />
				Sign in to start your first broadcast.
			</p>
			<button class="cta cta-light" on:click={signInWithGoogle}>
				<span class="cta-label">Continue with Google</span>
				<span class="cta-arrow">↗</span>
			</button>
			<div class="guest-divider">or</div>
			<form class="guest-form" on:submit|preventDefault={enterAsGuest}>
				<input
					type="text"
					placeholder="Enter your name"
					bind:value={guestName}
					autocomplete="off"
				/>
				<button type="submit" class="cta cta-light" disabled={!guestName.trim()}>
					<span class="cta-label">Join as guest</span>
				</button>
			</form>
			<div class="signin-footer">
				<span class="sig">— studio session</span>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}
</main>

<style>
	main {
		min-height: 100vh;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.75rem 2rem 4rem;
		position: relative;
	}

	.screen-center {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tuning {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.dots span {
		animation: -global-blink 1.4s infinite;
		display: inline-block;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border);
		animation: -global-fade-down 0.6s ease;
	}

	.wordmark {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text);
	}

	.user-strip {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.live-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.66rem;
		font-weight: 600;
		color: var(--accent);
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--accent-soft);
		border-radius: 999px;
		background: var(--accent-soft);
	}

	.live-pill .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent-glow);
		animation: -global-pulse 1.6s infinite;
	}

	.user-name {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.ghost {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 500;
		padding: 0.4rem 0.6rem;
		transition: color 0.2s;
	}

	.ghost:hover {
		color: var(--text);
	}

	.hero {
		padding: 6rem 0 4rem;
		max-width: 760px;
		animation: -global-fade-up 0.8s ease 0.2s backwards;
	}

	.eyebrow {
		display: block;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-faint);
		margin-bottom: 1.5rem;
	}

	.display {
		font-size: clamp(3rem, 8vw, 5.5rem);
		line-height: 1;
		font-weight: 500;
		margin: 0 0 1.5rem;
	}

	.display span {
		display: block;
	}

	.display .accent {
		font-weight: 600;
		color: var(--accent);
		padding-left: 1.5em;
	}

	.lede {
		font-size: 1.05rem;
		font-weight: 450;
		color: var(--text-muted);
		max-width: 38ch;
		margin: 0 0 3rem;
		line-height: 1.55;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 1rem;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: var(--accent);
		color: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 2px;
		font-weight: 600;
		font-size: 0.95rem;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		box-shadow: 0 0 0 0 var(--accent-glow);
	}

	.cta:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px -8px var(--accent-glow);
	}

	.cta-arrow {
		font-size: 1.1rem;
		font-weight: 450;
		transition: transform 0.2s;
	}

	.cta:hover .cta-arrow {
		transform: translate(2px, -2px);
	}

	.join {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--border-strong);
		border-radius: 2px;
		background: var(--surface);
		overflow: hidden;
		transition: border-color 0.2s;
	}

	.join:focus-within {
		border-color: var(--accent);
	}

	.field {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 1rem 0.4rem;
		min-width: 220px;
	}

	.field-label {
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--text-faint);
	}

	.field input {
		border: none;
		padding: 0.1rem 0;
		font-size: 1rem;
		font-weight: 500;
		color: var(--text);
		outline: none;
	}

	.field input::placeholder {
		color: var(--text-faint);
	}

	.join-btn {
		padding: 0 1.25rem;
		background: transparent;
		border: none;
		border-left: 1px solid var(--border);
		color: var(--text);
		font-size: 0.74rem;
		font-weight: 600;
		transition: background 0.2s, color 0.2s;
	}

	.join-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--bg);
	}

	.join-btn:disabled {
		color: var(--text-faint);
		cursor: not-allowed;
	}

	.footnote {
		margin-top: 4rem;
		display: flex;
		gap: 0.6rem;
		font-size: 0.68rem;
		font-weight: 500;
		color: var(--text-faint);
	}

	.signin {
		min-height: 80vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		max-width: 720px;
		margin: 0 auto;
		padding: 3rem 0;
		animation: -global-fade-up 1s ease;
	}

	.signin-eyebrow {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-faint);
		margin-bottom: 2rem;
	}

	.display-xl {
		font-size: clamp(5rem, 14vw, 11rem);
		line-height: 0.9;
		font-weight: 500;
		margin: 0 0 2rem;
	}

	.display-xl .accent {
		font-weight: 700;
		color: var(--accent);
	}

	.signin-lede {
		font-size: 1.1rem;
		font-weight: 450;
		color: var(--text-muted);
		margin: 0 0 3rem;
		line-height: 1.5;
	}

	.cta-light {
		background: var(--text);
		color: var(--bg);
		border-color: var(--text);
	}

	.cta-light:hover {
		background: var(--accent);
		border-color: var(--accent);
	}

	.guest-divider {
		margin: 1.5rem 0;
		font-size: 0.8rem;
		color: var(--text-faint);
	}

	.guest-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.guest-form input {
		padding: 0.75rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		color: var(--text);
		font-size: 0.9rem;
		font-family: inherit;
		outline: none;
	}

	.guest-form input::placeholder {
		color: var(--text-faint);
	}

	.signin-footer {
		margin-top: 4rem;
	}

	.sig {
		font-size: 0.85rem;
		font-weight: 450;
		color: var(--text-faint);
	}

	.error {
		margin-top: 2rem;
		padding: 0.8rem 1rem;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--danger);
		border-left: 2px solid var(--danger);
		background: rgba(209, 100, 100, 0.06);
	}

	@media (max-width: 720px) {
		main {
			padding: 1.25rem 1.25rem 3rem;
		}

		.user-name {
			display: none;
		}

		.hero {
			padding: 3rem 0 2rem;
		}

		.actions {
			flex-direction: column;
			align-items: stretch;
		}

		.cta {
			justify-content: center;
		}

		.join {
			width: 100%;
		}

		.field {
			flex: 1;
			min-width: 0;
		}

		.signin {
			padding: 2rem 0;
		}
	}
</style>
