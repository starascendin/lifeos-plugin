<script lang="ts">
	import { onMount } from 'svelte';
	import { Server } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils';
	import { mcpPresets } from '$lib/stores/mcp';

	export let value: string = '';

	let selectedNames: Set<string> = new Set();

	const { loading, serversByCategory, refresh } = mcpPresets;

	$: if (value !== Array.from(selectedNames).join(',')) {
		selectedNames = new Set(value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);
	}

	onMount(() => {
		refresh();
	});

	function toggleServer(name: string) {
		const newSet = new Set(selectedNames);
		if (newSet.has(name)) {
			newSet.delete(name);
		} else {
			newSet.add(name);
		}
		selectedNames = newSet;
		value = Array.from(selectedNames).join(',');
	}

	const categoryLabels: Record<string, string> = {
		lifeos: 'LifeOS',
		standard: 'Standard',
		other: 'Other'
	};
</script>

<div class="space-y-4">
	{#if $loading}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Loading presets...</div>
	{:else if Object.keys($serversByCategory).length === 0}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
			No preset servers available.
		</div>
	{:else}
		<ScrollArea class="h-72 rounded-md border">
			<div class="space-y-4 p-4">
				{#each Object.entries($serversByCategory) as [category, servers]}
					<div class="space-y-2">
						<h4 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							{categoryLabels[category] || category}
						</h4>
						<div class="space-y-2">
							{#each servers as server (server.name)}
								{@const isSelected = selectedNames.has(server.name)}
								<label
									class={cn(
										'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50',
										isSelected && 'border-primary bg-primary/5'
									)}
								>
									<Checkbox
										checked={isSelected}
										onCheckedChange={() => toggleServer(server.name)}
									/>
									<Server class="h-4 w-4 flex-shrink-0 text-blue-400" />
									<div class="min-w-0 flex-1">
										<div class="text-sm font-medium">{server.name}</div>
										{#if server.description}
											<div class="truncate text-xs text-muted-foreground">
												{server.description}
											</div>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</ScrollArea>

		{#if selectedNames.size > 0}
			<p class="text-xs text-muted-foreground">
				Selected: {Array.from(selectedNames).join(', ')}
			</p>
		{/if}
	{/if}
</div>
