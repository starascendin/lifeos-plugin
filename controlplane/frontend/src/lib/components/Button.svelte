<script lang="ts">
	import { Button as ShadcnButton, type ButtonProps } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { Loader2 } from 'lucide-svelte';

	type $$Props = ButtonProps & {
		loading?: boolean;
	};

	export let variant: $$Props['variant'] = 'default';
	export let size: $$Props['size'] = 'default';
	export let loading = false;
	export let disabled = false;
	let className: $$Props['class'] = undefined;
	export { className as class };
</script>

<ShadcnButton
	{variant}
	{size}
	disabled={disabled || loading}
	class={cn('gap-2', className)}
	{...$$restProps}
	on:click
>
	{#if loading}
		<Loader2 class="h-4 w-4 animate-spin" />
	{/if}
	<slot />
</ShadcnButton>
