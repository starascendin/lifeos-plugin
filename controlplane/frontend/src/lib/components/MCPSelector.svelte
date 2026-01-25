<script lang="ts">
	import { onMount } from 'svelte';
	import { Server } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils';
	import { mcpServers } from '$lib/stores/mcp';

	export let value: string = '';

	let selectedNames: Set<string> = new Set();

	$: if (value !== Array.from(selectedNames).join(',')) {
		selectedNames = new Set(value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);
	}

	onMount(() => {
		mcpServers.refresh();
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
</script>

<div class="space-y-2">
	<label class="mb-2 block text-sm font-medium">MCP Servers</label>

	{#if $mcpServers.length === 0}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
			No MCP servers configured.
			<a href="/settings" class="text-blue-400 hover:text-blue-300">Configure servers</a>
		</div>
	{:else}
		<ScrollArea class="h-64 rounded-md border">
			<div class="space-y-2 p-2">
				{#each $mcpServers.filter((s) => s.enabled) as server (server.name)}
					{@const isSelected = selectedNames.has(server.name)}
					<label
						class={cn(
							'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50',
							isSelected && 'border-primary bg-primary/5'
						)}
					>
						<Checkbox checked={isSelected} onCheckedChange={() => toggleServer(server.name)} />
						<Server class="h-4 w-4 flex-shrink-0 text-blue-400" />
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium">{server.name}</div>
							{#if server.description}
								<div class="truncate text-xs text-muted-foreground">{server.description}</div>
							{/if}
						</div>
					</label>
				{/each}
			</div>
		</ScrollArea>

		{#if selectedNames.size > 0}
			<p class="mt-2 text-xs text-muted-foreground">
				Selected: {Array.from(selectedNames).join(', ')}
			</p>
		{/if}
	{/if}
</div>
