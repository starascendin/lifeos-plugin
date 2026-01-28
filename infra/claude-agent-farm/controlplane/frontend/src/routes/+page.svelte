<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { Plus, RefreshCw, Trash2 } from 'lucide-svelte';
	import AgentCard from '$lib/components/AgentCard.svelte';
	import ConfigCard from '$lib/components/ConfigCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Textarea } from '$lib/components/ui/textarea';
	import { cn } from '$lib/utils';
	import { agents, runningCount, pendingCount } from '$lib/stores/agents';
	import { configs } from '$lib/stores/configs';
	import { stopAgent, launchAgent, cleanupPods } from '$lib/api/client';
	import type { AgentConfig, RunningAgent } from '$lib/api/types';

	// Modal state
	let launchModalOpen = false;
	let selectedConfig: AgentConfig | null = null;
	let taskPrompt = '';
	let launching = false;
	let cleaning = false;

	// Relaunching state (track by pod name)
	let relaunchingPods: Set<string> = new Set();

	// Logs modal
	let logsModalOpen = false;
	let logsPodName = '';
	let logsContent = '';

	// Filter state
	type StatusFilter = 'all' | 'running' | 'completed' | 'failed';
	let statusFilter: StatusFilter = 'all';

	// Derived filtered agents
	$: filteredAgents = ($agents || []).filter((agent: RunningAgent) => {
		if (statusFilter === 'all') return true;
		if (statusFilter === 'running') return agent.status === 'Running' || agent.status === 'Pending';
		if (statusFilter === 'completed') return agent.status === 'Succeeded';
		if (statusFilter === 'failed') return agent.status === 'Failed';
		return true;
	});

	// Counts for filter badges
	$: completedCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Succeeded').length;
	$: failedCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Failed').length;

	onMount(() => {
		agents.startAutoRefresh(10000);
		configs.refresh();
	});

	onDestroy(() => {
		agents.stopAutoRefresh();
	});

	async function handleStopAgent(e: CustomEvent<{ podName: string }>) {
		if (confirm(`Stop agent ${e.detail.podName}?`)) {
			try {
				await stopAgent(e.detail.podName);
				agents.removeAgent(e.detail.podName);
			} catch (err) {
				alert('Failed to stop agent: ' + (err as Error).message);
			}
		}
	}

	async function handleDeleteAgent(e: CustomEvent<{ podName: string }>) {
		try {
			await stopAgent(e.detail.podName);
			agents.removeAgent(e.detail.podName);
		} catch (err) {
			alert('Failed to delete pod: ' + (err as Error).message);
		}
	}

	function handleViewLogs(e: CustomEvent<{ podName: string }>) {
		logsPodName = e.detail.podName;
		logsContent = 'Loading...';
		logsModalOpen = true;
	}

	function handleLaunchConfig(e: CustomEvent<{ config: AgentConfig }>) {
		selectedConfig = e.detail.config;
		taskPrompt = e.detail.config.task_prompt;
		launchModalOpen = true;
	}

	async function doLaunch() {
		if (!selectedConfig) return;
		launching = true;
		try {
			await launchAgent(selectedConfig.convex_id || selectedConfig.id, taskPrompt);
			launchModalOpen = false;
			agents.refresh();
		} catch (err) {
			alert('Failed to launch agent: ' + (err as Error).message);
		} finally {
			launching = false;
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

	async function handleRelaunch(e: CustomEvent<{ podName: string; configId: string | number; taskPrompt: string }>) {
		const { podName, configId, taskPrompt: prompt } = e.detail;
		relaunchingPods = new Set([...relaunchingPods, podName]);
		try {
			// Stop the old pod first
			await stopAgent(podName);
			agents.removeAgent(podName);
			// Launch new pod with same config (will use latest MCP configs from Settings)
			await launchAgent(configId, prompt);
			agents.refresh();
		} catch (err) {
			alert('Failed to relaunch: ' + (err as Error).message);
		} finally {
			relaunchingPods = new Set([...relaunchingPods].filter(p => p !== podName));
		}
	}

	const filterButtons: { key: StatusFilter; label: string; colorActive: string }[] = [
		{ key: 'all', label: 'All', colorActive: 'bg-secondary text-secondary-foreground' },
		{ key: 'running', label: 'Running', colorActive: 'bg-green-600/20 text-green-400' },
		{ key: 'completed', label: 'Completed', colorActive: 'bg-blue-600/20 text-blue-400' },
		{ key: 'failed', label: 'Failed', colorActive: 'bg-red-600/20 text-red-400' }
	];

	function getFilterCount(key: StatusFilter): number {
		switch (key) {
			case 'all':
				return $agents.length;
			case 'running':
				return $runningCount + $pendingCount;
			case 'completed':
				return completedCount;
			case 'failed':
				return failedCount;
			default:
				return 0;
		}
	}
</script>

<div class="space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Dashboard</h1>
			<p class="text-sm text-muted-foreground">Manage your Claude agents</p>
		</div>
		<Button variant="secondary" on:click={() => agents.refresh()}>
			<RefreshCw class="h-4 w-4" />
			Refresh
		</Button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-sm text-muted-foreground">Running</p>
				<p class="text-2xl font-bold text-green-400">{$runningCount}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-sm text-muted-foreground">Pending</p>
				<p class="text-2xl font-bold text-yellow-400">{$pendingCount}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-sm text-muted-foreground">Total Agents</p>
				<p class="text-2xl font-bold">{$agents.length}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="pt-6">
				<p class="text-sm text-muted-foreground">Configs</p>
				<p class="text-2xl font-bold">{$configs.length}</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Running Agents -->
	<section>
		<div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
			<h2 class="text-lg font-semibold">Pods</h2>
			<div class="flex flex-wrap items-center gap-2">
				<!-- Status filter -->
				<div class="flex overflow-hidden rounded-lg border">
					{#each filterButtons as btn, idx}
						<button
							on:click={() => (statusFilter = btn.key)}
							class={cn(
								'px-3 py-1.5 text-xs font-medium transition-colors',
								idx > 0 && 'border-l',
								statusFilter === btn.key
									? btn.colorActive
									: 'bg-card text-muted-foreground hover:text-foreground'
							)}
						>
							{btn.label} ({getFilterCount(btn.key)})
						</button>
					{/each}
				</div>
				<!-- Cleanup button -->
				{#if completedCount + failedCount > 0}
					<Button variant="ghost" size="sm" on:click={handleCleanup} loading={cleaning}>
						<Trash2 class="h-4 w-4" />
						Cleanup
					</Button>
				{/if}
			</div>
		</div>

		{#if $agents.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center">
					<p class="text-muted-foreground">No pods running.</p>
					<p class="mt-1 text-sm text-muted-foreground/70">
						Launch one from a config below.
					</p>
				</Card.Content>
			</Card.Root>
		{:else if filteredAgents.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center">
					<p class="text-muted-foreground">No pods match the current filter.</p>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredAgents as agent (agent.pod_name)}
					<AgentCard
						{agent}
						relaunching={relaunchingPods.has(agent.pod_name)}
						on:stop={handleStopAgent}
						on:delete={handleDeleteAgent}
						on:logs={handleViewLogs}
						on:relaunch={handleRelaunch}
					/>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Configs -->
	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Agent Configs</h2>
			<Button variant="secondary" size="sm" on:click={() => goto('/configs')}>
				<Plus class="h-4 w-4" />
				New Config
			</Button>
		</div>

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
						on:launch={handleLaunchConfig}
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
	</section>
</div>

<!-- Launch Modal -->
<Modal bind:open={launchModalOpen} title="Launch Agent" size="md">
	{#if selectedConfig}
		<div class="space-y-4">
			<Card.Root>
				<Card.Content class="pt-4">
					<h4 class="mb-2 font-medium">{selectedConfig.name}</h4>
					<div class="space-y-1 text-sm text-muted-foreground">
						<p><strong>Repos:</strong> {selectedConfig.repos || 'None'}</p>
						<p>
							<strong>Limits:</strong>
							{selectedConfig.max_turns} turns, ${selectedConfig.max_budget_usd}
						</p>
						<p>
							<strong>Resources:</strong>
							{selectedConfig.cpu_limit} CPU, {selectedConfig.memory_limit}
						</p>
					</div>
				</Card.Content>
			</Card.Root>

			<div>
				<label for="task-prompt" class="mb-2 block text-sm font-medium">
					Task Prompt <span class="text-zinc-500">(optional)</span>
				</label>
				<Textarea
					id="task-prompt"
					bind:value={taskPrompt}
					rows={4}
					placeholder="Leave empty to use Chat tab or claude -p"
				/>
			</div>
		</div>
	{/if}

	<svelte:fragment slot="footer">
		<Button variant="ghost" on:click={() => (launchModalOpen = false)}>Cancel</Button>
		<Button on:click={doLaunch} loading={launching}>Launch Agent</Button>
	</svelte:fragment>
</Modal>

<!-- Logs Modal -->
<Modal bind:open={logsModalOpen} title="Logs: {logsPodName}" size="xl">
	<div class="h-96 overflow-auto rounded-lg bg-muted p-4 font-mono text-sm text-green-400">
		<pre>{logsContent}</pre>
	</div>
</Modal>
