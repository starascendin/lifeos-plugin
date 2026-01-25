<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import FormSection from '$lib/components/FormSection.svelte';
	import MCPPresetSelector from '$lib/components/MCPPresetSelector.svelte';
	import SkillToggle from '$lib/components/SkillToggle.svelte';
	import GitHubRepoSelector from '$lib/components/GitHubRepoSelector.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { configs } from '$lib/stores/configs';
	import type { AgentConfigCreate } from '$lib/api/types';

	let saving = false;

	let formData: AgentConfigCreate = {
		name: '',
		repos: '',
		task_prompt: '',
		system_prompt: '',
		max_turns: 50,
		max_budget_usd: 10,
		cpu_limit: '1000m',
		memory_limit: '2Gi',
		allowed_tools: 'Read,Write,Edit,Bash,Glob,Grep',
		enabled_mcps: '',
		enabled_skills: ''
	};

	async function handleSubmit() {
		if (!formData.name?.trim()) {
			alert('Name is required');
			return;
		}

		saving = true;
		try {
			await configs.add(formData);
			goto('/configs');
		} catch (err) {
			alert('Failed to create config: ' + (err as Error).message);
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a
			href="/configs"
			class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div class="min-w-0 flex-1">
			<h1 class="text-xl font-bold sm:text-2xl">New Config</h1>
			<p class="text-sm text-muted-foreground">Create a new agent configuration</p>
		</div>
		<Button on:click={handleSubmit} loading={saving} class="hidden sm:flex">
			<Save class="h-4 w-4" />
			Create Config
		</Button>
	</div>

	<form on:submit|preventDefault={handleSubmit} class="space-y-4">
		<!-- Basic Info -->
		<FormSection title="Basic Info" description="Name and repository settings">
			<div class="space-y-4">
				<div>
					<label for="name" class="mb-2 block text-sm font-medium">Name *</label>
					<Input
						id="name"
						type="text"
						bind:value={formData.name}
						required
						placeholder="my-agent"
					/>
				</div>

				<div>
					<label class="mb-2 block text-sm font-medium">Repositories</label>
					<GitHubRepoSelector bind:value={formData.repos} />

					<details class="mt-3">
						<summary class="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
							Or enter URLs manually
						</summary>
						<div class="mt-2">
							<Input
								id="repos"
								type="text"
								bind:value={formData.repos}
								placeholder="https://github.com/user/repo (comma-separated)"
								class="text-sm"
							/>
							<p class="mt-1 text-xs text-muted-foreground">
								Comma-separated list of Git repository URLs
							</p>
						</div>
					</details>
				</div>
			</div>
		</FormSection>

		<!-- Prompts -->
		<FormSection title="Prompts" description="Task and system instructions">
			<div class="space-y-4">
				<div>
					<label for="task_prompt" class="mb-2 block text-sm font-medium">
						Default Task Prompt
					</label>
					<Textarea
						id="task_prompt"
						bind:value={formData.task_prompt}
						rows={4}
						placeholder="What should the agent do?"
					/>
				</div>

				<div>
					<label for="system_prompt" class="mb-2 block text-sm font-medium">System Prompt</label>
					<Textarea
						id="system_prompt"
						bind:value={formData.system_prompt}
						rows={4}
						placeholder="Optional system instructions for the agent"
					/>
				</div>
			</div>
		</FormSection>

		<!-- MCP Servers -->
		<FormSection title="MCP Servers" description="Model Context Protocol integrations">
			<MCPPresetSelector bind:value={formData.enabled_mcps} />
		</FormSection>

		<!-- Claude Skills -->
		<FormSection title="Claude Skills" description="Additional capabilities for the agent">
			<SkillToggle bind:value={formData.enabled_skills} />
		</FormSection>

		<!-- Resource Limits -->
		<FormSection
			title="Resource Limits"
			description="Execution constraints and resource allocation"
			defaultOpen={false}
		>
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="max_turns" class="mb-2 block text-sm font-medium">Max Turns</label>
						<Input id="max_turns" type="number" bind:value={formData.max_turns} />
						<p class="mt-1 text-xs text-muted-foreground">Maximum conversation turns</p>
					</div>
					<div>
						<label for="max_budget" class="mb-2 block text-sm font-medium">Max Budget ($)</label>
						<Input id="max_budget" type="number" step="0.01" bind:value={formData.max_budget_usd} />
						<p class="mt-1 text-xs text-muted-foreground">Maximum spend limit in USD</p>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="cpu_limit" class="mb-2 block text-sm font-medium">CPU Limit</label>
						<Input id="cpu_limit" type="text" bind:value={formData.cpu_limit} placeholder="1000m" />
						<p class="mt-1 text-xs text-muted-foreground">
							Kubernetes CPU limit (e.g., 1000m = 1 core)
						</p>
					</div>
					<div>
						<label for="memory_limit" class="mb-2 block text-sm font-medium">Memory Limit</label>
						<Input
							id="memory_limit"
							type="text"
							bind:value={formData.memory_limit}
							placeholder="2Gi"
						/>
						<p class="mt-1 text-xs text-muted-foreground">Kubernetes memory limit</p>
					</div>
				</div>
			</div>
		</FormSection>

		<!-- Advanced -->
		<FormSection title="Advanced" description="Allowed tools and other settings" defaultOpen={false}>
			<div>
				<label for="allowed_tools" class="mb-2 block text-sm font-medium">Allowed Tools</label>
				<Input id="allowed_tools" type="text" bind:value={formData.allowed_tools} />
				<p class="mt-1 text-xs text-muted-foreground">
					Comma-separated list of allowed Claude tools
				</p>
			</div>
		</FormSection>

		<!-- Mobile submit button -->
		<div class="flex gap-3 pt-4 sm:hidden">
			<Button variant="ghost" class="flex-1" on:click={() => goto('/configs')}>Cancel</Button>
			<Button class="flex-1" on:click={handleSubmit} loading={saving}>Create Config</Button>
		</div>
	</form>
</div>
