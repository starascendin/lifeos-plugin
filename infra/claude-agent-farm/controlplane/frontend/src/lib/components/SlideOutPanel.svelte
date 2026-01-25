<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import { cn } from '$lib/utils';

	export let open = false;
	export let title = '';
	export let width: 'sm' | 'md' | 'lg' | 'xl' = 'md';

	const dispatch = createEventDispatcher<{ close: void }>();

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			dispatch('close');
		}
	}

	const widthClasses = {
		sm: 'w-80 sm:max-w-[20rem]',
		md: 'w-96 sm:max-w-[24rem]',
		lg: 'w-[32rem] sm:max-w-[32rem]',
		xl: 'w-[40rem] sm:max-w-[40rem]'
	};
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
	<Sheet.Content side="right" class={cn(widthClasses[width], 'flex flex-col')}>
		<Sheet.Header>
			<Sheet.Title>{title}</Sheet.Title>
		</Sheet.Header>
		<div class="flex-1 overflow-y-auto py-4">
			<slot />
		</div>
		{#if $$slots.footer}
			<Sheet.Footer>
				<slot name="footer" />
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>
