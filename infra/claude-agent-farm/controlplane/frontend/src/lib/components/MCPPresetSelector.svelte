<script lang="ts">
	import { onMount } from 'svelte';
	import { Server, RefreshCw } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { getActiveServers } from '$lib/api/client';
	import type { MCPServer } from '$lib/api/types';

	export let value: string = '';

	let selectedNames: Set<string> = new Set();
	let servers: MCPServer[] = [];
	let loading = false;
	let error = '';

	$: if (value !== Array.from(selectedNames).join(',')) {
		selectedNames = new Set(value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);
	}

	async function refresh() {
		loading = true;
		error = '';
		try {
			servers = await getActiveServers();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load servers';
			servers = [];
		} finally {
			loading = false;
		}
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

	function parseArgs(argsJson: string): string[] {
		try {
			return JSON.parse(argsJson || '[]');
		} catch {
			return [];
		}
	}

	function parseEnv(envJson: string): Record<string, string> {
		try {
			return JSON.parse(envJson || '{}');
		} catch {
			return {};
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<p class="text-xs text-muted-foreground">
			Servers from your <a href="/settings" class="text-blue-400 hover:underline">Settings</a>
		</p>
		<Button
			variant="ghost"
			size="sm"
			on:click={() => refresh()}
			disabled={loading}
			class="h-8 gap-1.5 text-xs text-muted-foreground"
		>
			<RefreshCw class={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
			Refresh
		</Button>
	</div>

	{#if loading}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Loading servers...</div>
	{:else if error}
		<div class="rounded-lg bg-destructive/10 border border-destructive/50 p-3 text-sm text-destructive">
			{error}
		</div>
	{:else if servers.length === 0}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
			No servers configured. <a href="/settings" class="text-blue-400 hover:underline">Add servers in Settings</a>
		</div>
	{:else}
		<ScrollArea class="h-72 rounded-md border">
			<div class="space-y-2 p-4">
				{#each servers as server (server.name)}
					{@const isSelected = selectedNames.has(server.name)}
					{@const args = parseArgs(server.args)}
					{@const env = parseEnv(server.env)}
					<label
						class={cn(
							'block cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50',
							isSelected && 'border-primary bg-primary/5'
						)}
					>
						<div class="flex items-center gap-3">
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
						</div>
						<div class="mt-2 ml-9 space-y-1 font-mono text-xs text-muted-foreground/70">
							<div class="truncate">
								<span class="text-muted-foreground">cmd:</span> {server.command} {args.join(' ')}
							</div>
							{#if Object.keys(env).length > 0}
								<div class="truncate">
									<span class="text-muted-foreground">env:</span>
									{Object.keys(env).join(', ')}
								</div>
							{/if}
						</div>
					</label>
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
