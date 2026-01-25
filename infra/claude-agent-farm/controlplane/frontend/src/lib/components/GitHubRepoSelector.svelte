<script lang="ts">
	import { onMount } from 'svelte';
	import { Lock, Unlock, Search, AlertCircle, RefreshCw } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils';
	import { getGitHubRepos } from '$lib/api/client';
	import type { GitHubRepo } from '$lib/api/types';

	export let value: string = '';

	let repos: GitHubRepo[] = [];
	let loading = true;
	let error: string | null = null;
	let searchQuery = '';
	let selectedUrls: Set<string> = new Set();

	$: if (value !== Array.from(selectedUrls).join(',')) {
		selectedUrls = new Set(value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);
	}

	$: filteredRepos = repos.filter(
		(repo) =>
			repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	onMount(() => {
		loadRepos();
	});

	async function loadRepos() {
		loading = true;
		error = null;
		try {
			repos = await getGitHubRepos();
		} catch (err) {
			const message = (err as Error).message;
			if (message.includes('GITHUB_PAT not configured') || message.includes('503')) {
				error = 'GitHub not configured. Set GITHUB_PAT environment variable.';
			} else {
				error = `Failed to load repos: ${message}`;
			}
			repos = [];
		} finally {
			loading = false;
		}
	}

	function toggleRepo(cloneUrl: string) {
		const newSet = new Set(selectedUrls);
		if (newSet.has(cloneUrl)) {
			newSet.delete(cloneUrl);
		} else {
			newSet.add(cloneUrl);
		}
		selectedUrls = newSet;
		value = Array.from(selectedUrls).join(',');
	}

	function isSelected(cloneUrl: string): boolean {
		return selectedUrls.has(cloneUrl);
	}
</script>

<div class="space-y-3">
	{#if loading}
		<div class="flex items-center gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
			<RefreshCw class="h-4 w-4 animate-spin" />
			Loading GitHub repositories...
		</div>
	{:else if error}
		<div
			class="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-400"
		>
			<AlertCircle class="h-4 w-4" />
			{error}
		</div>
	{:else if repos.length === 0}
		<div class="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
			No repositories found.
		</div>
	{:else}
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="text"
				bind:value={searchQuery}
				placeholder="Search repositories..."
				class="pl-10"
			/>
		</div>

		<ScrollArea class="h-64 rounded-md border">
			<div class="space-y-2 p-2">
				{#each filteredRepos as repo (repo.full_name)}
					{@const selected = isSelected(repo.clone_url)}
					<label
						class={cn(
							'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50',
							selected && 'border-primary bg-primary/5'
						)}
					>
						<Checkbox checked={selected} onCheckedChange={() => toggleRepo(repo.clone_url)} />
						{#if repo.private}
							<Lock class="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
						{:else}
							<Unlock class="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
						{/if}
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium">{repo.full_name}</div>
							{#if repo.description}
								<div class="truncate text-xs text-muted-foreground">{repo.description}</div>
							{/if}
						</div>
					</label>
				{/each}

				{#if filteredRepos.length === 0 && searchQuery}
					<div class="p-3 text-center text-sm text-muted-foreground">
						No repos match "{searchQuery}"
					</div>
				{/if}
			</div>
		</ScrollArea>

		{#if selectedUrls.size > 0}
			<p class="text-xs text-muted-foreground">
				{selectedUrls.size} repo{selectedUrls.size !== 1 ? 's' : ''} selected
			</p>
		{/if}
	{/if}
</div>
