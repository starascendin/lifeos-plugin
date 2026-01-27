<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { RefreshCw, Trash2, Square, RotateCw, CheckSquare, XSquare } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import { agents } from '$lib/stores/agents';
	import { stopAgent, launchAgent, recreateAgentPod, cleanupPods } from '$lib/api/client';
	import type { RunningAgent } from '$lib/api/types';

	// Selection state
	let selectedPods: Set<string> = new Set();
	let selectAll = false;

	// Action state
	let deleting = false;
	let cleaning = false;
	let relaunchingPods: Set<string> = new Set();

	// Filter state
	type StatusFilter = 'all' | 'running' | 'completed' | 'failed';
	let statusFilter: StatusFilter = 'all';

	$: filteredAgents = ($agents || []).filter((agent: RunningAgent) => {
		if (statusFilter === 'all') return true;
		if (statusFilter === 'running') return agent.status === 'Running' || agent.status === 'Pending';
		if (statusFilter === 'completed') return agent.status === 'Succeeded';
		if (statusFilter === 'failed') return agent.status === 'Failed';
		return true;
	});

	$: runningCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Running' || a.status === 'Pending').length;
	$: completedCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Succeeded').length;
	$: failedCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Failed').length;

	// Update selectAll when selection changes
	$: selectAll = filteredAgents.length > 0 && filteredAgents.every((a: RunningAgent) => selectedPods.has(a.pod_name));

	onMount(() => {
		agents.startAutoRefresh(5000);
	});

	onDestroy(() => {
		agents.stopAutoRefresh();
	});

	function toggleSelectAll() {
		if (selectAll) {
			selectedPods = new Set();
		} else {
			selectedPods = new Set(filteredAgents.map((a: RunningAgent) => a.pod_name));
		}
	}

	function toggleSelect(podName: string) {
		const newSet = new Set(selectedPods);
		if (newSet.has(podName)) {
			newSet.delete(podName);
		} else {
			newSet.add(podName);
		}
		selectedPods = newSet;
	}

	async function deleteSelected() {
		if (selectedPods.size === 0) return;
		if (!confirm(`Delete ${selectedPods.size} pod(s)?`)) return;

		deleting = true;
		try {
			for (const podName of selectedPods) {
				await stopAgent(podName);
				agents.removeAgent(podName);
			}
			selectedPods = new Set();
		} catch (err) {
			alert('Failed to delete pods: ' + (err as Error).message);
		} finally {
			deleting = false;
			agents.refresh();
		}
	}

	async function stopPod(podName: string) {
		if (!confirm(`Stop pod ${podName}?`)) return;
		try {
			await stopAgent(podName);
			agents.removeAgent(podName);
			selectedPods.delete(podName);
			selectedPods = selectedPods;
		} catch (err) {
			alert('Failed to stop pod: ' + (err as Error).message);
		}
	}

	async function deletePod(podName: string) {
		try {
			await stopAgent(podName);
			agents.removeAgent(podName);
			selectedPods.delete(podName);
			selectedPods = selectedPods;
		} catch (err) {
			alert('Failed to delete pod: ' + (err as Error).message);
		}
	}

	async function relaunchPod(agent: RunningAgent) {
		relaunchingPods = new Set([...relaunchingPods, agent.pod_name]);
		try {
			await stopAgent(agent.pod_name);
			agents.removeAgent(agent.pod_name);

			if (agent.persistent) {
				// Persistent pod - recreate using GetOrCreateAgentPod
				await recreateAgentPod(agent.config_id);
			} else {
				// Task job - launch with task prompt
				await launchAgent(agent.config_id, agent.task_prompt);
			}
			agents.refresh();
		} catch (err) {
			alert('Failed to relaunch: ' + (err as Error).message);
		} finally {
			relaunchingPods = new Set([...relaunchingPods].filter(p => p !== agent.pod_name));
		}
	}

	async function handleCleanup() {
		if (!confirm('Delete all completed/failed pods older than 5 minutes?')) return;
		cleaning = true;
		try {
			const result = await cleanupPods(5);
			alert(result.message);
			agents.refresh();
		} catch (err) {
			alert('Failed to cleanup: ' + (err as Error).message);
		} finally {
			cleaning = false;
		}
	}

	function formatTime(dateStr: string) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${Math.floor(diffHours / 24)}d ago`;
	}

	const statusColors: Record<string, string> = {
		Running: 'bg-green-500',
		Pending: 'bg-yellow-500',
		Succeeded: 'bg-blue-500',
		Failed: 'bg-red-500',
		Unknown: 'bg-gray-500'
	};

	const statusBadgeColors: Record<string, string> = {
		Running: 'bg-green-500/20 text-green-400 border-green-500/30',
		Pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
		Succeeded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
		Unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
	};

	const filterButtons: { key: StatusFilter; label: string; count: () => number; color: string }[] = [
		{ key: 'all', label: 'All', count: () => $agents.length, color: 'bg-secondary text-secondary-foreground' },
		{ key: 'running', label: 'Running', count: () => runningCount, color: 'bg-green-600/20 text-green-400' },
		{ key: 'completed', label: 'Completed', count: () => completedCount, color: 'bg-blue-600/20 text-blue-400' },
		{ key: 'failed', label: 'Failed', count: () => failedCount, color: 'bg-red-600/20 text-red-400' }
	];
</script>

<div class="space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Pods</h1>
			<p class="text-sm text-muted-foreground">Manage running agent pods</p>
		</div>
		<div class="flex gap-2">
			<Button variant="secondary" size="sm" on:click={() => agents.refresh()}>
				<RefreshCw class="h-4 w-4" />
				Refresh
			</Button>
		</div>
	</div>

	<!-- Filters and Actions Bar -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<!-- Status filter -->
		<div class="flex overflow-hidden rounded-lg border">
			{#each filterButtons as btn, idx}
				<button
					on:click={() => { statusFilter = btn.key; selectedPods = new Set(); }}
					class={cn(
						'px-3 py-1.5 text-xs font-medium transition-colors',
						idx > 0 && 'border-l',
						statusFilter === btn.key ? btn.color : 'bg-card text-muted-foreground hover:text-foreground'
					)}
				>
					{btn.label} ({btn.count()})
				</button>
			{/each}
		</div>

		<!-- Bulk actions -->
		<div class="flex gap-2">
			{#if selectedPods.size > 0}
				<Button variant="destructive" size="sm" on:click={deleteSelected} loading={deleting}>
					<Trash2 class="h-4 w-4" />
					Delete ({selectedPods.size})
				</Button>
			{/if}
			{#if completedCount + failedCount > 0}
				<Button variant="outline" size="sm" on:click={handleCleanup} loading={cleaning}>
					<Trash2 class="h-4 w-4" />
					Cleanup Old
				</Button>
			{/if}
		</div>
	</div>

	<!-- Pods Table -->
	{#if $agents.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-lg text-muted-foreground">No pods running</p>
				<p class="mt-2 text-sm text-muted-foreground/70">Launch an agent from a config to get started</p>
			</Card.Content>
		</Card.Root>
	{:else if filteredAgents.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">No pods match the current filter</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b text-left text-sm text-muted-foreground">
							<th class="p-3 w-10">
								<Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} />
							</th>
							<th class="p-3">Pod Name</th>
							<th class="p-3 hidden sm:table-cell">Config</th>
							<th class="p-3 hidden md:table-cell">Status</th>
							<th class="p-3 hidden lg:table-cell">Started</th>
							<th class="p-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredAgents as agent (agent.pod_name)}
							{@const isSelected = selectedPods.has(agent.pod_name)}
							{@const isTerminated = agent.status === 'Succeeded' || agent.status === 'Failed'}
							{@const isRelaunching = relaunchingPods.has(agent.pod_name)}
							<tr class={cn('border-b transition-colors hover:bg-muted/50', isSelected && 'bg-muted/30')}>
								<td class="p-3">
									<Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(agent.pod_name)} />
								</td>
								<td class="p-3">
									<div class="flex items-center gap-2">
										<div class={cn('h-2 w-2 rounded-full', statusColors[agent.status])} />
										<div class="min-w-0">
											<div class="truncate font-medium text-sm">{agent.pod_name}</div>
											<div class="truncate text-xs text-muted-foreground sm:hidden">{agent.config_name}</div>
										</div>
									</div>
								</td>
								<td class="p-3 hidden sm:table-cell">
									<span class="text-sm text-muted-foreground">{agent.config_name}</span>
								</td>
								<td class="p-3 hidden md:table-cell">
									<Badge variant="outline" class={cn('text-xs', statusBadgeColors[agent.status])}>
										{agent.status}
									</Badge>
								</td>
								<td class="p-3 hidden lg:table-cell">
									<span class="text-sm text-muted-foreground">{formatTime(agent.started_at)}</span>
								</td>
								<td class="p-3">
									<div class="flex justify-end gap-1">
										<Button
											variant="ghost"
											size="sm"
											class="h-8 w-8 p-0"
											disabled={isRelaunching}
											on:click={() => relaunchPod(agent)}
											title="Relaunch with latest config"
										>
											<RotateCw class={cn('h-4 w-4', isRelaunching && 'animate-spin')} />
										</Button>
										{#if isTerminated}
											<Button
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0 text-destructive hover:text-destructive"
												on:click={() => deletePod(agent.pod_name)}
												title="Delete pod"
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										{:else}
											<Button
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0 text-destructive hover:text-destructive"
												on:click={() => stopPod(agent.pod_name)}
												title="Stop pod"
											>
												<Square class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card.Root>
	{/if}
</div>
