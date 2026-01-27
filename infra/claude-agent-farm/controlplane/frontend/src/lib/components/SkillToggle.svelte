<script lang="ts">
	import { onMount } from 'svelte';
	import { Sparkles } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import { skills, skillsByCategory, categoryLabels } from '$lib/stores/skills';

	export let value: string = '';

	let selectedNames: Set<string> = new Set();

	// Sync selectedNames when value prop changes
	$: if (value !== Array.from(selectedNames).join(',')) {
		selectedNames = new Set(value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);
	}

	onMount(() => {
		skills.refresh();
	});

	function toggleSkill(name: string) {
		const newSet = new Set(selectedNames);
		if (newSet.has(name)) {
			newSet.delete(name);
		} else {
			newSet.add(name);
		}
		selectedNames = newSet;
		value = Array.from(selectedNames).join(',');
	}

	// Filter to only show enabled skills
	$: enabledSkillsByCategory = Object.fromEntries(
		Object.entries($skillsByCategory)
			.map(([category, categorySkills]) => [
				category,
				categorySkills.filter((s) => s.enabled)
			])
			.filter(([, categorySkills]) => categorySkills.length > 0)
	);
</script>

<div class="space-y-4">
	{#if $skills.loading}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Loading skills...</div>
	{:else if Object.keys(enabledSkillsByCategory).length === 0}
		<div class="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
			No skills available. Add skills in Settings.
		</div>
	{:else}
		<ScrollArea class="h-72 rounded-md border">
			<div class="space-y-4 p-4">
				{#each Object.entries(enabledSkillsByCategory) as [category, categorySkills]}
					<div class="space-y-2">
						<h4 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							{categoryLabels[category] || category}
						</h4>
						<div class="space-y-2">
							{#each categorySkills as skill (skill.name)}
								{@const isSelected = selectedNames.has(skill.name)}
								<label
									class={cn(
										'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50',
										isSelected && 'border-purple-500 bg-purple-500/5'
									)}
								>
									<Checkbox
										checked={isSelected}
										onCheckedChange={() => toggleSkill(skill.name)}
									/>
									<Sparkles class="h-4 w-4 flex-shrink-0 text-purple-400" />
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-sm font-medium">{skill.name}</span>
											{#if skill.is_builtin}
												<Badge variant="secondary" class="text-xs">builtin</Badge>
											{/if}
										</div>
										{#if skill.description}
											<div class="truncate text-xs text-muted-foreground">
												{skill.description}
											</div>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</ScrollArea>

		{#if selectedNames.size > 0}
			<p class="text-xs text-muted-foreground">
				Selected: {Array.from(selectedNames).join(', ')}
			</p>
		{/if}
	{/if}
</div>
