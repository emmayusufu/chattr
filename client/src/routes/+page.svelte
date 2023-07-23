<script lang="ts">
	import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
	import { auth } from '../firebase';

	const signInWithGoogle = async () => {
		const provider = new GoogleAuthProvider();
		try {
			const userCredentials = await signInWithPopup(auth, provider);
			console.log(userCredentials);
		} catch (error) {
			console.error('Error signing in with Google:', error);
		}
	};
</script>

<button on:click={signInWithGoogle}>Sign In with Google</button>

<button on:click={() => auth.signOut()}>Sign Out</button>
