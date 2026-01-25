<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { cn } from '$lib/utils';

	export let title: string;
	export let description: string = '';
	export let defaultOpen: boolean = true;

	let isOpen = defaultOpen;
</script>

<Collapsible.Root bind:open={isOpen} class="rounded-lg border bg-card">
	<Collapsible.Trigger
		class="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-accent/50"
	>
		<div class="text-left">
			<h3 class="font-medium">{title}</h3>
			{#if description}
				<p class="text-sm text-muted-foreground mt-0.5">{description}</p>
			{/if}
		</div>
		<ChevronDown
			class={cn(
				'h-5 w-5 text-muted-foreground transition-transform duration-200',
				isOpen && 'rotate-180'
			)}
		/>
	</Collapsible.Trigger>
	<Collapsible.Content class="px-4 pb-4 pt-0">
		<div class="space-y-4 pt-4 border-t border-border/50">
			<slot />
		</div>
	</Collapsible.Content>
</Collapsible.Root>
