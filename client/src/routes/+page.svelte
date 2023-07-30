<script lang="ts">
	import {
		GoogleAuthProvider,
		onAuthStateChanged,
		signInWithPopup,
		type User
	} from 'firebase/auth';
	import { auth } from '../firebase';
	import { onMount } from 'svelte';

	let isLoggedIn = false;
	let user: User;
	let loading: boolean = true;
	let error: string | null = null;

	const signInWithGoogle = async () => {
		const provider = new GoogleAuthProvider();
		try {
			await signInWithPopup(auth, provider);
		} catch (error) {
			console.error('Error signing in with Google:', error);
			error = 'Failed to sign in with Google. Please try again later.';
		}
	};

	onMount(() => {
		onAuthStateChanged(auth, (userData) => {
			try {
				isLoggedIn = !!userData;
				if (userData) {
					user = userData;
				}
			} catch (error) {
				console.error('Error during auth state change:', error);
				error = 'Failed to get user data. Please try again later.';
			} finally {
				loading = false;
			}
		});
	});
</script>

<main>
	{#if loading}
		<p>Loading...</p>
	{:else if error}
		<p style="color: red;">{error}</p>
	{:else if isLoggedIn}
		<button on:click={() => auth.signOut()}>Sign out</button>
		<p>Welcome {user.displayName}!</p>
	{:else}
		<button on:click={signInWithGoogle}>Sign in with Google</button>
	{/if}

	{#if error}
		<p style="color: red;">{error}</p>
	{/if}
</main>
