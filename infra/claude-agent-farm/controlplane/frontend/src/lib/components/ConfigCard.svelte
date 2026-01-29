<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { MessageSquare, Edit2, Trash2, Cpu, DollarSign, RotateCcw } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import type { AgentConfig } from '$lib/api/types';

	export let config: AgentConfig;

	const dispatch = createEventDispatcher<{
		chat: { config: AgentConfig };
		edit: { config: AgentConfig };
		delete: { config: AgentConfig };
	}>();
</script>

<Card.Root class="transition-colors hover:border-accent">
	<Card.Header class="pb-3">
		<Card.Title class="text-base">{config.name}</Card.Title>
	</Card.Header>

	<Card.Content class="space-y-4">
		<p class="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
			{config.task_prompt || 'No default task prompt'}
		</p>

		<div class="flex flex-wrap gap-2">
			<Badge variant="secondary" class="gap-1">
				<RotateCcw class="h-3 w-3" />
				{config.max_turns} turns
			</Badge>
			<Badge variant="secondary" class="gap-1">
				<DollarSign class="h-3 w-3" />
				${config.max_budget_usd}
			</Badge>
			<Badge variant="secondary" class="gap-1">
				<Cpu class="h-3 w-3" />
				{config.cpu_limit}
			</Badge>
		</div>
	</Card.Content>

	<Card.Footer class="gap-2 pt-0">
		<Button
			variant="default"
			size="sm"
			class="flex-1"
			on:click={() => dispatch('chat', { config })}
		>
			<MessageSquare class="h-4 w-4" />
			Chat
		</Button>
		<Button
			variant="secondary"
			size="icon"
			class="h-9 w-9"
			on:click={() => dispatch('edit', { config })}
		>
			<Edit2 class="h-4 w-4" />
		</Button>
		<Button
			variant="ghost"
			size="icon"
			class="h-9 w-9 text-muted-foreground hover:text-destructive"
			on:click={() => dispatch('delete', { config })}
		>
			<Trash2 class="h-4 w-4" />
		</Button>
	</Card.Footer>
</Card.Root>
