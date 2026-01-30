<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, X, RotateCcw } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import Button from '$lib/components/Button.svelte';
	import { getEnvVarDefaults } from '$lib/api/client';
	import type { EnvVarDefault } from '$lib/api/types';

	export let value: string = '';

	let defaults: EnvVarDefault[] = [];
	let loading = true;
	let overrides: Record<string, string> = {};
	let customVars: Array<{ name: string; value: string }> = [];
	let newVarName = '';

	// Parse the JSON value into overrides map
	function parseValue(val: string) {
		if (!val) {
			overrides = {};
			customVars = [];
			return;
		}
		try {
			const parsed = JSON.parse(val) as Record<string, string>;
			overrides = {};
			customVars = [];
			const defaultNames = new Set(defaults.map((d) => d.name));
			for (const [k, v] of Object.entries(parsed)) {
				if (defaultNames.has(k)) {
					overrides[k] = v;
				} else {
					customVars = [...customVars, { name: k, value: v }];
				}
			}
		} catch {
			overrides = {};
			customVars = [];
		}
	}

	// Serialize overrides + customVars back to JSON string
	function serialize() {
		const result: Record<string, string> = {};
		for (const [k, v] of Object.entries(overrides)) {
			if (v !== '') {
				result[k] = v;
			}
		}
		for (const cv of customVars) {
			if (cv.name && cv.value) {
				result[cv.name] = cv.value;
			}
		}
		value = Object.keys(result).length > 0 ? JSON.stringify(result) : '';
	}

	function handleOverrideChange(name: string, newVal: string) {
		if (newVal === '') {
			delete overrides[name];
			overrides = overrides;
		} else {
			overrides[name] = newVal;
		}
		serialize();
	}

	function resetOverride(name: string) {
		delete overrides[name];
		overrides = overrides;
		serialize();
	}

	function addCustomVar() {
		const trimmed = newVarName.trim().toUpperCase();
		if (!trimmed) return;
		// Prevent duplicates
		if (defaults.some((d) => d.name === trimmed) || customVars.some((c) => c.name === trimmed))
			return;
		customVars = [...customVars, { name: trimmed, value: '' }];
		newVarName = '';
	}

	function removeCustomVar(index: number) {
		customVars = customVars.filter((_, i) => i !== index);
		serialize();
	}

	function handleCustomVarChange(index: number, val: string) {
		customVars[index].value = val;
		serialize();
	}

	onMount(async () => {
		try {
			defaults = await getEnvVarDefaults();
		} catch (err) {
			console.error('Failed to load env var defaults:', err);
			defaults = [];
		} finally {
			loading = false;
			parseValue(value);
		}
	});

	// Re-parse when value changes externally
	$: if (!loading) parseValue(value);
</script>

{#if loading}
	<p class="text-sm text-muted-foreground">Loading environment variables...</p>
{:else}
	<div class="space-y-2">
		{#each defaults as envVar}
			{@const hasOverride = envVar.name in overrides}
			<div class="flex items-center gap-2">
				<div class="w-44 shrink-0">
					<span class="font-mono text-xs font-medium">{envVar.name}</span>
				</div>
				<div class="relative flex-1">
					<Input
						type={envVar.sensitive && !hasOverride ? 'password' : 'text'}
						value={hasOverride ? overrides[envVar.name] : envVar.value}
						placeholder={envVar.sensitive ? '********' : envVar.description}
						class="h-8 text-xs font-mono {hasOverride
							? 'border-blue-500/50 bg-blue-500/5'
							: ''}"
						on:input={(e) => handleOverrideChange(envVar.name, e.currentTarget.value)}
					/>
				</div>
				{#if hasOverride}
					<button
						type="button"
						class="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
						title="Reset to default"
						on:click={() => resetOverride(envVar.name)}
					>
						<RotateCcw class="h-3.5 w-3.5" />
					</button>
				{:else}
					<span
						class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
						>default</span
					>
				{/if}
			</div>
		{/each}

		<!-- Custom env vars -->
		{#each customVars as cv, i}
			<div class="flex items-center gap-2">
				<div class="w-44 shrink-0">
					<span class="font-mono text-xs font-medium">{cv.name}</span>
				</div>
				<div class="flex-1">
					<Input
						type="text"
						value={cv.value}
						placeholder="Value"
						class="h-8 text-xs font-mono border-green-500/50 bg-green-500/5"
						on:input={(e) => handleCustomVarChange(i, e.currentTarget.value)}
					/>
				</div>
				<button
					type="button"
					class="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					title="Remove"
					on:click={() => removeCustomVar(i)}
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		{/each}

		<!-- Add custom var -->
		<div class="flex items-center gap-2 pt-1">
			<div class="w-44 shrink-0">
				<Input
					type="text"
					bind:value={newVarName}
					placeholder="VAR_NAME"
					class="h-8 text-xs font-mono uppercase"
					on:keydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addCustomVar();
						}
					}}
				/>
			</div>
			<Button variant="ghost" size="sm" class="h-8 text-xs" on:click={addCustomVar}>
				<Plus class="h-3.5 w-3.5 mr-1" />
				Add
			</Button>
		</div>
	</div>
{/if}
