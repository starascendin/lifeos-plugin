<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { cn } from '$lib/utils';

	export let open = false;
	export let title = '';
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

	const dispatch = createEventDispatcher<{ close: void }>();

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			dispatch('close');
		}
	}

	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl'
	};
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class={cn(sizeClasses[size], 'max-h-[90vh] overflow-hidden flex flex-col')}>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		<div class="flex-1 overflow-y-auto py-4">
			<slot />
		</div>
		{#if $$slots.footer}
			<Dialog.Footer>
				<slot name="footer" />
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
