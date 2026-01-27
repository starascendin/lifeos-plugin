<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { FileText, Clock, Cpu, Server, MessageSquare, Bot, Zap, Trash2, Square, RotateCw } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { RunningAgent } from '$lib/api/types';

	export let agent: RunningAgent;
	export let relaunching = false;

	const dispatch = createEventDispatcher<{
		stop: { podName: string };
		delete: { podName: string };
		logs: { podName: string };
		relaunch: { podName: string; configId: number; taskPrompt: string };
	}>();

	const statusColors: Record<string, string> = {
		Running: 'bg-green-500',
		Pending: 'bg-yellow-500',
		Succeeded: 'bg-blue-500',
		Failed: 'bg-red-500',
		Unknown: 'bg-gray-500',
	};

	const statusTextColors: Record<string, string> = {
		Running: 'text-green-400',
		Pending: 'text-yellow-400',
		Succeeded: 'text-blue-400',
		Failed: 'text-red-400',
		Unknown: 'text-muted-foreground',
	};

	const podTypeIcons: Record<string, typeof MessageSquare> = {
		chat: MessageSquare,
		agent: Bot,
		job: Zap,
	};

	const podTypeColors: Record<string, string> = {
		chat: 'text-blue-400 bg-blue-400/10',
		agent: 'text-green-400 bg-green-400/10',
		job: 'text-orange-400 bg-orange-400/10',
	};

	$: isTerminated = agent.status === 'Succeeded' || agent.status === 'Failed';
	$: PodIcon = podTypeIcons[agent.pod_type] || Zap;

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
</script>

<Card.Root class={cn('transition-colors hover:border-accent', isTerminated && 'opacity-60')}>
	<Card.Header class="pb-3">
		<div class="flex items-start justify-between">
			<div class="flex-1 min-w-0 space-y-1">
				<div class="flex items-center gap-2">
					<Badge variant="outline" class={cn('gap-1 rounded-md text-xs font-medium', podTypeColors[agent.pod_type] || 'text-muted-foreground bg-muted')}>
						<svelte:component this={PodIcon} class="h-3 w-3" />
						{agent.pod_type}
					</Badge>
					{#if agent.persistent}
						<Badge variant="outline" class="rounded-md text-xs bg-purple-400/10 text-purple-400 border-purple-400/20">
							persistent
						</Badge>
					{/if}
				</div>
				<Card.Title class="truncate text-base">{agent.pod_name}</Card.Title>
				<Card.Description class="text-sm">{agent.config_name}</Card.Description>
			</div>
			<div class="flex items-center gap-1.5 ml-2">
				<div class={cn('w-2 h-2 rounded-full', statusColors[agent.status] || statusColors.Unknown)} />
				<span class={cn('text-sm font-medium', statusTextColors[agent.status] || statusTextColors.Unknown)}>
					{agent.status}
				</span>
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4">
		<p class="text-sm text-muted-foreground line-clamp-2">
			{agent.task_prompt || 'No task prompt'}
		</p>

		<div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
			<div class="flex items-center gap-1">
				<Clock class="h-3.5 w-3.5" />
				<span>{formatTime(agent.started_at)}</span>
			</div>
			<div class="flex items-center gap-1">
				<Server class="h-3.5 w-3.5" />
				<span>{agent.node || 'N/A'}</span>
			</div>
			{#if agent.runtime_class}
				<div class="flex items-center gap-1">
					<Cpu class="h-3.5 w-3.5" />
					<span>{agent.runtime_class}</span>
				</div>
			{/if}
		</div>
	</Card.Content>

	<Card.Footer class="gap-2 pt-0">
		<Button
			variant="secondary"
			size="sm"
			class="flex-1"
			on:click={() => dispatch('logs', { podName: agent.pod_name })}
		>
			<FileText class="h-4 w-4" />
			Logs
		</Button>
		{#if isTerminated}
			<Button
				variant="outline"
				size="sm"
				disabled={relaunching}
				on:click={() => dispatch('relaunch', { podName: agent.pod_name, configId: agent.config_id, taskPrompt: agent.task_prompt })}
			>
				<RotateCw class={cn('h-4 w-4', relaunching && 'animate-spin')} />
				{relaunching ? 'Relaunching...' : 'Relaunch'}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				class="text-muted-foreground hover:text-destructive"
				on:click={() => dispatch('delete', { podName: agent.pod_name })}
			>
				<Trash2 class="h-4 w-4" />
			</Button>
		{:else}
			<Button
				variant="outline"
				size="sm"
				disabled={relaunching}
				on:click={() => dispatch('relaunch', { podName: agent.pod_name, configId: agent.config_id, taskPrompt: agent.task_prompt })}
			>
				<RotateCw class={cn('h-4 w-4', relaunching && 'animate-spin')} />
				{relaunching ? 'Relaunching...' : 'Relaunch'}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				class="text-destructive hover:text-destructive hover:bg-destructive/10"
				on:click={() => dispatch('stop', { podName: agent.pod_name })}
			>
				<Square class="h-4 w-4" />
			</Button>
		{/if}
	</Card.Footer>
</Card.Root>
