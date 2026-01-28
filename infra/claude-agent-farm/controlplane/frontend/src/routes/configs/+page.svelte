<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Plus, ArrowLeft } from 'lucide-svelte';
	import ConfigCard from '$lib/components/ConfigCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import * as Card from '$lib/components/ui/card';
	import { configs } from '$lib/stores/configs';
	import type { AgentConfig } from '$lib/api/types';

	onMount(() => {
		configs.refresh();
	});

	async function handleDelete(config: AgentConfig) {
		if (confirm(`Delete config "${config.name}"?`)) {
			await configs.remove(config.convex_id || config.id);
		}
	}
</script>

<div class="space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a
			href="/"
			class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div class="min-w-0 flex-1">
			<h1 class="text-xl font-bold sm:text-2xl">Agent Configs</h1>
			<p class="text-sm text-muted-foreground">Create and manage agent configurations</p>
		</div>
		<Button on:click={() => goto('/configs/new')}>
			<Plus class="h-4 w-4" />
			<span class="hidden sm:inline">New Config</span>
			<span class="sm:hidden">New</span>
		</Button>
	</div>

	<!-- Configs Grid -->
	{#if $configs.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-lg text-muted-foreground">No configs yet</p>
				<p class="mb-4 mt-2 text-sm text-muted-foreground/70">
					Create your first agent configuration to get started
				</p>
				<Button on:click={() => goto('/configs/new')}>
					<Plus class="h-4 w-4" />
					Create Config
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each $configs as config (config.convex_id || config.id)}
				<ConfigCard
					{config}
					on:launch={() => goto('/?launch=' + (config.convex_id || config.id))}
					on:edit={() => goto('/configs/' + (config.convex_id || config.id))}
					on:delete={() => handleDelete(config)}
				/>
			{/each}
		</div>
	{/if}
</div>
