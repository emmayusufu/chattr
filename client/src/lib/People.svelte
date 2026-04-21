<script lang="ts">
	import type { Participant, PendingJoiner } from './RoomClient';

	export let senderName: string;
	export let participants: Record<string, Participant>;
	export let pendingJoiners: PendingJoiner[];
	export let isHost: boolean;
	export let onApprove: (userId: string) => void;
	export let onDeny: (userId: string) => void;
	export let onApproveAll: () => void;
	export let onCreateInvite: () => void;
</script>

<div class="people-pane">
	{#if isHost && pendingJoiners.length > 0}
		<section class="lobby">
			<header>
				<span class="section-title">In the lobby</span>
				<div class="lobby-meta">
					<span class="count">{pendingJoiners.length}</span>
					{#if pendingJoiners.length > 1}
						<button class="admit-all" on:click={onApproveAll}>Admit all</button>
					{/if}
				</div>
			</header>
			<ul class="lobby-list">
				{#each pendingJoiners as p (p.userId)}
					<li>
						<span class="name">{p.name}</span>
						<div class="actions">
							<button class="approve" on:click={() => onApprove(p.userId)}>Allow</button>
							<button class="deny" on:click={() => onDeny(p.userId)}>Deny</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="in-room">
		<header>
			<span class="section-title">In the room</span>
			<span class="count">{Object.keys(participants).length + 1}</span>
		</header>
		<ul class="people-list">
			<li>
				<span class="name">{senderName}</span>
				<span class="tag">you{isHost ? ' · host' : ''}</span>
			</li>
			{#each Object.entries(participants) as [pid, p] (pid)}
				<li>
					<span class="name">{p.name}</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if isHost}
		<section class="host-actions">
			<button class="invite-btn" on:click={onCreateInvite}> Generate invite link </button>
			<p class="hint">A one-time URL that lets the recipient skip the lobby.</p>
		</section>
	{/if}
</div>

<style>
	.people-pane {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.6rem;
	}

	.section-title {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.lobby-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.count {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent);
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--accent-soft);
		border-radius: 999px;
		background: var(--accent-soft);
	}

	.admit-all {
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 600;
		background: var(--accent);
		color: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 4px;
		cursor: pointer;
	}

	.admit-all:hover {
		opacity: 0.9;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.lobby-list li,
	.people-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		background: var(--surface-2);
		border-radius: 4px;
	}

	.name {
		font-size: 0.9rem;
		color: var(--text);
	}

	.tag {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--accent);
	}

	.actions {
		display: flex;
		gap: 0.3rem;
	}

	.actions button {
		padding: 0.25rem 0.55rem;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 600;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.actions .approve {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
	}

	.actions .approve:hover {
		opacity: 0.9;
	}

	.actions .deny:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.host-actions {
		margin-top: auto;
		padding-top: 0.85rem;
		border-top: 1px solid var(--border);
	}

	.invite-btn {
		width: 100%;
		padding: 0.55rem 0.7rem;
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.invite-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.hint {
		font-size: 0.72rem;
		color: var(--text-faint);
		margin: 0.4rem 0 0;
	}
</style>
