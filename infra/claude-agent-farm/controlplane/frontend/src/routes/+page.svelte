<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Plus } from 'lucide-svelte';
	import ConfigCard from '$lib/components/ConfigCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import * as Card from '$lib/components/ui/card';
	import { configs } from '$lib/stores/configs';
	import { chatActions } from '$lib/stores/chat';
	import type { AgentConfig } from '$lib/api/types';

	onMount(() => {
		configs.refresh();
	});

	function handleChat(e: CustomEvent<{ config: AgentConfig }>) {
		const config = e.detail.config;
		chatActions.selectAgent(config.name, config.convex_id || config.id);
		goto('/chat');
	}
</script>

<div class="space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Agent Configs</h1>
			<p class="text-sm text-muted-foreground">Configure and chat with agents</p>
		</div>
		<Button variant="secondary" size="sm" on:click={() => goto('/configs')}>
			<Plus class="h-4 w-4" />
			New
		</Button>
	</div>

	<!-- Config Cards -->
	{#if $configs.length === 0}
		<Card.Root>
			<Card.Content class="py-8 text-center">
				<p class="text-muted-foreground">No configs yet.</p>
				<p class="mt-1 text-sm text-muted-foreground/70">Create one to get started!</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each $configs as config (config.convex_id || config.id)}
				<ConfigCard
					{config}
					on:chat={handleChat}
					on:edit={() => goto('/configs?edit=' + (config.convex_id || config.id))}
					on:delete={async () => {
						if (confirm(`Delete config "${config.name}"?`)) {
							await configs.remove(config.convex_id || config.id);
						}
					}}
				/>
			{/each}
		</div>
	{/if}
</div>
