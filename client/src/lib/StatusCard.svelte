<script lang="ts">
	export let eyebrow: string;
	export let title: string;
	export let tone: 'accent' | 'danger' = 'accent';
</script>

<div class="card" class:tone-danger={tone === 'danger'}>
	<span class="eyebrow">{eyebrow}</span>
	<h2>{title}</h2>
	<slot />
</div>

<style>
	.card {
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 2rem;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-left: 3px solid var(--accent);
		border-radius: 4px;
		animation: -global-fade-up 0.4s ease;
	}

	.card.tone-danger {
		border-left-color: var(--danger);
	}

	.eyebrow {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--accent);
	}

	.tone-danger .eyebrow {
		color: var(--danger);
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
	}
</style>
