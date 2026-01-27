<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Download,
		Trash2,
		Server,
		ChevronDown,
		ChevronRight,
		Save,
		FileText,
		Check,
		RefreshCw,
		Sparkles,
		Plus,
		Pencil,
		Square,
		RotateCw,
		Smartphone,
		Container
	} from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import ConfigCard from '$lib/components/ConfigCard.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { cn } from '$lib/utils';
	import {
		getTomlConfigs,
		getTomlConfig,
		createTomlConfig,
		updateTomlConfig,
		deleteTomlConfig,
		getActiveServers,
		stopAgent,
		launchAgent,
		recreateAgentPod,
		cleanupPods,
		getSystemInfo,
		type SystemInfo
	} from '$lib/api/client';
	import type { MCPTomlConfig, MCPServer, Skill, AgentConfig, RunningAgent } from '$lib/api/types';
	import { skills, skillsByCategory, categoryLabels } from '$lib/stores/skills';
	import { configs } from '$lib/stores/configs';
	import { agents } from '$lib/stores/agents';
	import {
		isNative,
		getCurrentBundle,
		fetchLatestVersion,
		downloadAndApply,
		type CurrentBundleInfo,
		type LatestVersionInfo
	} from '$lib/capacitor/updater';

	// Tab state - show App first on mobile (native), MCP first on web
	type Tab = 'app' | 'mcp' | 'skills' | 'pods' | 'configs';
	let activeTab: Tab = isNative ? 'app' : 'mcp';

	// App/Update state
	let currentBundle: CurrentBundleInfo | null = null;
	let latestVersion: LatestVersionInfo | null = null;
	let checkingUpdate = false;
	let downloadingUpdate = false;
	let downloadProgress = 0;
	let updateError = '';
	let systemInfo: SystemInfo | null = null;

	// MCP state
	let tomlContent = '';
	let importError = '';
	let importSuccess = '';
	let jsonContent = '';
	let converting = false;
	let jsonConverterOpen = false;
	let convertError = '';
	let savedConfigs: MCPTomlConfig[] = [];
	let selectedConfig: string = '';
	let newConfigName = '';
	let savingConfig = false;
	let showSaveAs = false;
	let activeServers: MCPServer[] = [];
	let loadingServers = false;
	let clearingCache = false;
	let cacheMessage = '';

	// Skills state
	let editingSkill: string | null = null;
	let newSkillMode = false;
	let skillForm = {
		name: '',
		install_command: '',
		description: '',
		category: 'other'
	};
	let skillError = '';
	let skillSuccess = '';

	// Pods state
	let selectedPods: Set<string> = new Set();
	let deleting = false;
	let cleaning = false;
	let relaunchingPods: Set<string> = new Set();
	type StatusFilter = 'all' | 'running' | 'completed' | 'failed';
	let statusFilter: StatusFilter = 'all';

	$: filteredAgents = ($agents || []).filter((agent: RunningAgent) => {
		if (statusFilter === 'all') return true;
		if (statusFilter === 'running') return agent.status === 'Running' || agent.status === 'Pending';
		if (statusFilter === 'completed') return agent.status === 'Succeeded';
		if (statusFilter === 'failed') return agent.status === 'Failed';
		return true;
	});

	$: runningCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Running' || a.status === 'Pending').length;
	$: completedCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Succeeded').length;
	$: failedCount = ($agents || []).filter((a: RunningAgent) => a.status === 'Failed').length;

	// App/Update functions
	async function loadAppInfo() {
		// Always load system info
		try {
			systemInfo = await getSystemInfo();
		} catch (e) {
			console.error('Failed to load system info:', e);
		}

		if (!isNative) return;
		currentBundle = await getCurrentBundle();
		latestVersion = await fetchLatestVersion();
	}

	async function handleCheckUpdate() {
		checkingUpdate = true;
		updateError = '';
		try {
			latestVersion = await fetchLatestVersion();
			currentBundle = await getCurrentBundle();
		} catch (e) {
			updateError = e instanceof Error ? e.message : 'Failed to check updates';
		} finally {
			checkingUpdate = false;
		}
	}

	async function handleDownloadUpdate() {
		if (!latestVersion) return;
		downloadingUpdate = true;
		downloadProgress = 0;
		updateError = '';
		try {
			const result = await downloadAndApply(latestVersion.url, latestVersion.version, (progress) => {
				downloadProgress = progress;
			});
			if (!result.success) {
				updateError = result.error || 'Update failed';
			}
			// If successful, app will reload automatically
		} catch (e) {
			updateError = e instanceof Error ? e.message : 'Update failed';
		} finally {
			downloadingUpdate = false;
		}
	}

	$: hasUpdate = currentBundle && latestVersion && currentBundle.version !== latestVersion.version;

	// MCP Functions
	async function clearMCPCache() {
		clearingCache = true;
		cacheMessage = '';
		try {
			const response = await fetch('/api/mcp/clear-cache', { method: 'POST' });
			const data = await response.json();
			if (response.ok) {
				cacheMessage = data.message || 'Cache cleared successfully';
			} else {
				cacheMessage = data.error || 'Failed to clear cache';
			}
		} catch (e) {
			cacheMessage = e instanceof Error ? e.message : 'Failed to clear cache';
		} finally {
			clearingCache = false;
			setTimeout(() => (cacheMessage = ''), 5000);
		}
	}

	async function loadSavedConfigs() {
		try {
			savedConfigs = await getTomlConfigs();
		} catch (e) {
			console.error('Failed to load saved configs:', e);
		}
	}

	async function loadActiveServers() {
		loadingServers = true;
		try {
			activeServers = await getActiveServers();
		} catch (e) {
			console.error('Failed to load active servers:', e);
			activeServers = [];
		} finally {
			loadingServers = false;
		}
	}

	async function loadConfig(name: string) {
		try {
			const config = await getTomlConfig(name);
			tomlContent = config.content;
			selectedConfig = name;
			importError = '';
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to load config';
		}
	}

	async function saveCurrentConfig() {
		const name = newConfigName.trim() || selectedConfig;
		if (!name) {
			importError = 'Please enter a config name';
			return;
		}
		savingConfig = true;
		try {
			const existing = savedConfigs.find((c) => c.name === name);
			if (existing) {
				await updateTomlConfig(name, tomlContent);
			} else {
				await createTomlConfig(name, tomlContent);
			}
			await loadSavedConfigs();
			await loadActiveServers();
			selectedConfig = name;
			newConfigName = '';
			showSaveAs = false;
			importSuccess = `Saved "${name}"`;
			setTimeout(() => (importSuccess = ''), 3000);
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to save config';
		} finally {
			savingConfig = false;
		}
	}

	async function deleteConfig(name: string) {
		if (!confirm(`Delete config "${name}"?`)) return;
		try {
			await deleteTomlConfig(name);
			await loadSavedConfigs();
			await loadActiveServers();
			if (selectedConfig === name) {
				selectedConfig = '';
				tomlContent = '';
			}
			importSuccess = `Deleted "${name}"`;
			setTimeout(() => (importSuccess = ''), 3000);
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to delete config';
		}
	}

	function downloadToml() {
		const blob = new Blob([tomlContent], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${selectedConfig || 'mcp-servers'}.toml`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function handleConvertJson() {
		converting = true;
		convertError = '';
		try {
			const response = await fetch('/api/mcp/convert-json', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ json: jsonContent })
			});
			if (!response.ok) {
				const err = await response.text();
				throw new Error(err);
			}
			const data = await response.json();
			tomlContent = data.toml;
			jsonContent = '';
			jsonConverterOpen = false;
			selectedConfig = '';
			showSaveAs = true;
			newConfigName = '';
			importSuccess = 'Converted to TOML - save it as a new config';
			setTimeout(() => (importSuccess = ''), 5000);
		} catch (e) {
			convertError = e instanceof Error ? e.message : 'Conversion failed';
		} finally {
			converting = false;
		}
	}

	// Skill Functions
	function startEditSkill(skill: Skill) {
		editingSkill = skill.name;
		skillForm = {
			name: skill.name,
			install_command: skill.install_command,
			description: skill.description,
			category: skill.category
		};
		newSkillMode = false;
	}

	function startNewSkill() {
		newSkillMode = true;
		editingSkill = null;
		skillForm = { name: '', install_command: '', description: '', category: 'other' };
	}

	function cancelSkillEdit() {
		editingSkill = null;
		newSkillMode = false;
		skillForm = { name: '', install_command: '', description: '', category: 'other' };
		skillError = '';
	}

	async function saveSkill() {
		skillError = '';
		try {
			if (newSkillMode) {
				if (!skillForm.name || !skillForm.install_command) {
					skillError = 'Name and install command are required';
					return;
				}
				await skills.add(skillForm);
				skillSuccess = `Created "${skillForm.name}"`;
			} else if (editingSkill) {
				await skills.edit(editingSkill, {
					install_command: skillForm.install_command,
					description: skillForm.description,
					category: skillForm.category
				});
				skillSuccess = `Updated "${editingSkill}"`;
			}
			cancelSkillEdit();
			setTimeout(() => (skillSuccess = ''), 3000);
		} catch (e) {
			skillError = e instanceof Error ? e.message : 'Failed to save skill';
		}
	}

	async function handleDeleteSkill(name: string) {
		if (!confirm(`Delete skill "${name}"?`)) return;
		try {
			await skills.remove(name);
			skillSuccess = `Deleted "${name}"`;
			setTimeout(() => (skillSuccess = ''), 3000);
		} catch (e) {
			skillError = e instanceof Error ? e.message : 'Failed to delete skill';
		}
	}

	async function handleToggleSkill(name: string, enabled: boolean) {
		try {
			await skills.toggle(name, enabled);
		} catch (e) {
			skillError = e instanceof Error ? e.message : 'Failed to toggle skill';
		}
	}

	// Pods Functions
	function toggleSelect(podName: string) {
		const newSet = new Set(selectedPods);
		if (newSet.has(podName)) {
			newSet.delete(podName);
		} else {
			newSet.add(podName);
		}
		selectedPods = newSet;
	}

	async function deleteSelectedPods() {
		if (selectedPods.size === 0) return;
		if (!confirm(`Delete ${selectedPods.size} pod(s)?`)) return;

		deleting = true;
		try {
			for (const podName of selectedPods) {
				await stopAgent(podName);
				agents.removeAgent(podName);
			}
			selectedPods = new Set();
		} catch (err) {
			alert('Failed to delete pods: ' + (err as Error).message);
		} finally {
			deleting = false;
			agents.refresh();
		}
	}

	async function stopPod(podName: string) {
		try {
			await stopAgent(podName);
			agents.removeAgent(podName);
			selectedPods.delete(podName);
			selectedPods = selectedPods;
		} catch (err) {
			alert('Failed to stop pod: ' + (err as Error).message);
		}
	}

	async function relaunchPod(agent: RunningAgent) {
		relaunchingPods = new Set([...relaunchingPods, agent.pod_name]);
		try {
			await stopAgent(agent.pod_name);
			agents.removeAgent(agent.pod_name);
			if (agent.persistent) {
				await recreateAgentPod(agent.config_id);
			} else {
				await launchAgent(agent.config_id, agent.task_prompt);
			}
			agents.refresh();
		} catch (err) {
			alert('Failed to relaunch: ' + (err as Error).message);
		} finally {
			relaunchingPods = new Set([...relaunchingPods].filter(p => p !== agent.pod_name));
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

	const statusColors: Record<string, string> = {
		Running: 'bg-green-500',
		Pending: 'bg-yellow-500',
		Succeeded: 'bg-blue-500',
		Failed: 'bg-red-500',
		Unknown: 'bg-gray-500'
	};

	function setStatusFilter(key: string) {
		statusFilter = key as StatusFilter;
		selectedPods = new Set();
	}

	// Configs Functions
	async function handleDeleteConfig(config: AgentConfig) {
		if (confirm(`Delete config "${config.name}"?`)) {
			await configs.remove(config.id);
		}
	}

	onMount(() => {
		loadSavedConfigs();
		loadActiveServers();
		skills.refresh();
		configs.refresh();
		agents.startAutoRefresh(5000);
		loadAppInfo();
	});

	onDestroy(() => {
		agents.stopAutoRefresh();
	});

	// Tab definitions - conditionally show App tab only on native
	$: tabs = [
		...(isNative ? [{ key: 'app' as Tab, label: 'App', icon: Smartphone }] : []),
		{ key: 'mcp' as Tab, label: 'MCP', icon: Server },
		{ key: 'skills' as Tab, label: 'Skills', icon: Sparkles },
		{ key: 'pods' as Tab, label: 'Pods', icon: Container },
		{ key: 'configs' as Tab, label: 'Configs', icon: FileText }
	];
</script>

<div class="space-y-4 p-4 md:p-6">
	<!-- Header -->
	<div>
		<h1 class="text-xl font-bold sm:text-2xl">Settings</h1>
		<p class="text-sm text-muted-foreground">Manage your agent farm</p>
	</div>

	<!-- Tab Navigation -->
	<div class="flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
		{#each tabs as tab}
			<button
				on:click={() => (activeTab = tab.key)}
				class={cn(
					'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
					activeTab === tab.key
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
			>
				<svelte:component this={tab.icon} class="h-4 w-4" />
				<span class="hidden sm:inline">{tab.label}</span>
			</button>
		{/each}
	</div>

	<!-- App Tab (OTA Updates) -->
	{#if activeTab === 'app'}
		<div class="space-y-4">
			<!-- System Info -->
			{#if systemInfo}
				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
							Backend
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">Storage</span>
							<Badge variant={systemInfo.storage_type === 'convex' ? 'default' : 'secondary'}>
								{systemInfo.storage_type}
							</Badge>
						</div>
						{#if systemInfo.convex_url}
							<div class="flex items-center justify-between gap-2">
								<span class="text-sm text-muted-foreground">Convex URL</span>
								<span class="truncate text-xs font-mono text-foreground/80">{systemInfo.convex_url}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">Kubernetes</span>
							<Badge variant={systemInfo.k8s_enabled ? 'default' : 'secondary'} class={systemInfo.k8s_enabled ? 'bg-green-600/20 text-green-400' : ''}>
								{systemInfo.k8s_enabled ? 'Connected' : 'Disabled'}
							</Badge>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">GitHub</span>
							<Badge variant={systemInfo.github_enabled ? 'default' : 'secondary'} class={systemInfo.github_enabled ? 'bg-green-600/20 text-green-400' : ''}>
								{systemInfo.github_enabled ? 'Connected' : 'Disabled'}
							</Badge>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
						App Version
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if !isNative}
						<p class="text-sm text-muted-foreground">Running in web mode - OTA updates are only available in the native app.</p>
					{:else if currentBundle}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Current Version</span>
								<Badge variant="outline">{currentBundle.version}</Badge>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Native Version</span>
								<Badge variant="secondary">{currentBundle.nativeVersion}</Badge>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Status</span>
								<Badge variant="secondary">{currentBundle.status}</Badge>
							</div>
						</div>

						{#if latestVersion}
							<div class="border-t pt-4">
								<div class="flex items-center justify-between">
									<span class="text-sm text-muted-foreground">Latest Available</span>
									<Badge variant={hasUpdate ? 'default' : 'outline'} class={hasUpdate ? 'bg-blue-600' : ''}>
										{latestVersion.version}
									</Badge>
								</div>
							</div>
						{/if}

						{#if updateError}
							<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
								{updateError}
							</div>
						{/if}

						<div class="flex gap-2 border-t pt-4">
							<Button
								variant="outline"
								size="sm"
								on:click={handleCheckUpdate}
								loading={checkingUpdate}
								class="flex-1"
							>
								<RefreshCw class="h-4 w-4" />
								Check Update
							</Button>

							{#if hasUpdate}
								<Button
									size="sm"
									on:click={handleDownloadUpdate}
									loading={downloadingUpdate}
									class="flex-1"
								>
									<Download class="h-4 w-4" />
									{downloadingUpdate ? `${downloadProgress}%` : 'Update Now'}
								</Button>
							{/if}
						</div>
					{:else}
						<div class="py-4 text-center">
							<div class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
							<p class="mt-2 text-sm text-muted-foreground">Loading...</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	<!-- MCP Servers Tab -->
	{#if activeTab === 'mcp'}
		<div class="space-y-4">
			<!-- Active Servers Summary -->
			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center justify-between">
						<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
							Active Servers
						</Card.Title>
						<Badge variant="outline" class="bg-green-600/20 text-green-400">
							{activeServers.length}
						</Badge>
					</div>
				</Card.Header>
				<Card.Content>
					{#if loadingServers}
						<div class="py-4 text-center">
							<div class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
						</div>
					{:else if activeServers.length === 0}
						<p class="py-2 text-center text-sm text-muted-foreground">No active servers</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each activeServers as server (server.name)}
								<Badge variant="secondary" class="gap-1.5">
									<div class="h-1.5 w-1.5 rounded-full bg-green-500"></div>
									{server.name}
								</Badge>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Saved Configs -->
			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center justify-between">
						<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
							Saved Configs
						</Card.Title>
						<button
							on:click={() => {
								showSaveAs = !showSaveAs;
								newConfigName = '';
								selectedConfig = '';
								tomlContent = '';
							}}
							class="text-xs text-blue-400 hover:text-blue-300"
						>
							+ New
						</button>
					</div>
				</Card.Header>
				<Card.Content>
					{#if savedConfigs.length === 0}
						<p class="py-2 text-center text-sm text-muted-foreground">No saved configs</p>
					{:else}
						<div class="space-y-2">
							{#each savedConfigs as config (config.name)}
								<div class="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
									<button
										on:click={() => loadConfig(config.name)}
										class={cn('flex-1 text-left text-sm', selectedConfig === config.name && 'text-blue-400')}
									>
										{config.name}
									</button>
									{#if !config.is_default}
										<button
											on:click|stopPropagation={() => deleteConfig(config.name)}
											class="p-1 text-muted-foreground hover:text-destructive"
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if showSaveAs}
						<div class="mt-3 flex gap-2 border-t pt-3">
							<Input
								type="text"
								bind:value={newConfigName}
								placeholder="Config name..."
								class="h-8 text-sm"
							/>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- TOML Editor -->
			{#if selectedConfig || showSaveAs}
				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Title class="text-sm text-muted-foreground">
							{selectedConfig || newConfigName || 'New Config'}
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-3">
						<Textarea
							bind:value={tomlContent}
							rows={8}
							class="font-mono text-xs"
							placeholder="[servers.example]&#10;command = &quot;npx&quot;&#10;args = [&quot;-y&quot;, &quot;@anthropic/mcp-server&quot;]"
						/>

						{#if importError}
							<div class="text-xs text-destructive">{importError}</div>
						{/if}
						{#if importSuccess}
							<div class="text-xs text-green-400">{importSuccess}</div>
						{/if}

						<div class="flex gap-2">
							<Button size="sm" on:click={saveCurrentConfig} loading={savingConfig} class="flex-1">
								<Save class="h-3.5 w-3.5" />
								Save
							</Button>
							<Button size="sm" variant="outline" on:click={downloadToml} disabled={!tomlContent}>
								<Download class="h-3.5 w-3.5" />
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Cache & JSON Converter -->
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					on:click={clearMCPCache}
					loading={clearingCache}
					class="flex-1"
				>
					<RefreshCw class="h-4 w-4" />
					Clear Cache
				</Button>
			</div>
			{#if cacheMessage}
				<p class="text-center text-xs text-muted-foreground">{cacheMessage}</p>
			{/if}

			<Collapsible.Root bind:open={jsonConverterOpen}>
				<Collapsible.Trigger class="w-full">
					<div class="flex items-center justify-between rounded-lg bg-muted/30 p-3 text-sm">
						<span class="text-muted-foreground">Convert JSON to TOML</span>
						{#if jsonConverterOpen}
							<ChevronDown class="h-4 w-4" />
						{:else}
							<ChevronRight class="h-4 w-4" />
						{/if}
					</div>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Card.Root class="mt-2">
						<Card.Content class="space-y-3 pt-4">
							<Textarea
								bind:value={jsonContent}
								rows={5}
								class="font-mono text-xs"
								placeholder={'{"mcpServers": {...}}'}
							/>
							{#if convertError}
								<div class="text-xs text-destructive">{convertError}</div>
							{/if}
							<Button size="sm" on:click={handleConvertJson} loading={converting} disabled={!jsonContent.trim()}>
								Convert
							</Button>
						</Card.Content>
					</Card.Root>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	{/if}

	<!-- Skills Tab -->
	{#if activeTab === 'skills'}
		<div class="space-y-4">
			{#if !newSkillMode && !editingSkill}
				<Button on:click={startNewSkill} variant="outline" size="sm">
					<Plus class="h-4 w-4" />
					Add Skill
				</Button>
			{/if}

			{#if skillSuccess}
				<div class="flex items-center gap-2 rounded-lg bg-green-900/30 p-2 text-xs text-green-400">
					<Check class="h-3.5 w-3.5" />
					{skillSuccess}
				</div>
			{/if}
			{#if skillError}
				<div class="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{skillError}</div>
			{/if}

			{#if newSkillMode}
				<Card.Root>
					<Card.Content class="space-y-3 pt-4">
						<Input bind:value={skillForm.name} placeholder="Skill name" class="h-8 text-sm" />
						<Input bind:value={skillForm.install_command} placeholder="Install command" class="h-8 text-sm" />
						<Input bind:value={skillForm.description} placeholder="Description" class="h-8 text-sm" />
						<select bind:value={skillForm.category} class="h-8 w-full rounded-md border bg-background px-2 text-sm">
							<option value="git">Git Tools</option>
							<option value="productivity">Productivity</option>
							<option value="other">Other</option>
						</select>
						<div class="flex gap-2">
							<Button variant="ghost" size="sm" on:click={cancelSkillEdit}>Cancel</Button>
							<Button size="sm" on:click={saveSkill}>Create</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			{#if $skills.length === 0 && !newSkillMode}
				<Card.Root>
					<Card.Content class="py-6 text-center">
						<Sparkles class="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">No skills configured</p>
					</Card.Content>
				</Card.Root>
			{:else}
				{#each Object.entries($skillsByCategory) as [category, categorySkills]}
					<div class="space-y-2">
						<h3 class="text-xs font-medium text-muted-foreground">{categoryLabels[category] || category}</h3>
						{#each categorySkills as skill (skill.name)}
							{#if editingSkill === skill.name}
								<Card.Root>
									<Card.Content class="space-y-2 pt-3">
										<Input bind:value={skillForm.install_command} placeholder="Install command" class="h-8 text-sm" />
										<Input bind:value={skillForm.description} placeholder="Description" class="h-8 text-sm" />
										<div class="flex gap-2">
											<Button variant="ghost" size="sm" on:click={cancelSkillEdit}>Cancel</Button>
											<Button size="sm" on:click={saveSkill}>Save</Button>
										</div>
									</Card.Content>
								</Card.Root>
							{:else}
								<div class={cn('flex items-center gap-2 rounded-lg bg-muted/30 p-2', !skill.enabled && 'opacity-50')}>
									<button
										on:click={() => handleToggleSkill(skill.name, !skill.enabled)}
										class={cn('h-4 w-4 rounded border-2', skill.enabled ? 'border-primary bg-primary' : 'border-muted-foreground/50')}
									>
										{#if skill.enabled}<Check class="h-3 w-3 text-primary-foreground" />{/if}
									</button>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-1.5">
											<span class="text-sm font-medium">{skill.name}</span>
											{#if skill.is_builtin}<Badge variant="secondary" class="text-[10px]">builtin</Badge>{/if}
										</div>
										{#if skill.description}
											<p class="truncate text-xs text-muted-foreground">{skill.description}</p>
										{/if}
									</div>
									<button on:click={() => startEditSkill(skill)} class="p-1 text-muted-foreground hover:text-foreground">
										<Pencil class="h-3.5 w-3.5" />
									</button>
									{#if !skill.is_builtin}
										<button on:click={() => handleDeleteSkill(skill.name)} class="p-1 text-muted-foreground hover:text-destructive">
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Pods Tab -->
	{#if activeTab === 'pods'}
		<div class="space-y-4">
			<!-- Quick Stats -->
			<div class="flex gap-2 overflow-x-auto">
				{#each [
					{ key: 'all', label: 'All', count: $agents.length, color: 'bg-secondary' },
					{ key: 'running', label: 'Running', count: runningCount, color: 'bg-green-600/20 text-green-400' },
					{ key: 'completed', label: 'Done', count: completedCount, color: 'bg-blue-600/20 text-blue-400' },
					{ key: 'failed', label: 'Failed', count: failedCount, color: 'bg-red-600/20 text-red-400' }
				] as btn}
					<button
						on:click={() => setStatusFilter(btn.key)}
						class={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium', statusFilter === btn.key ? btn.color : 'bg-muted/30 text-muted-foreground')}
					>
						{btn.label} ({btn.count})
					</button>
				{/each}
			</div>

			<!-- Bulk Actions -->
			{#if selectedPods.size > 0 || completedCount + failedCount > 0}
				<div class="flex gap-2">
					{#if selectedPods.size > 0}
						<Button variant="destructive" size="sm" on:click={deleteSelectedPods} loading={deleting}>
							<Trash2 class="h-4 w-4" />
							Delete ({selectedPods.size})
						</Button>
					{/if}
					{#if completedCount + failedCount > 0}
						<Button variant="outline" size="sm" on:click={handleCleanup} loading={cleaning}>
							<Trash2 class="h-4 w-4" />
							Cleanup
						</Button>
					{/if}
				</div>
			{/if}

			<!-- Pods List -->
			{#if $agents.length === 0}
				<Card.Root>
					<Card.Content class="py-8 text-center">
						<Container class="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">No pods running</p>
					</Card.Content>
				</Card.Root>
			{:else if filteredAgents.length === 0}
				<Card.Root>
					<Card.Content class="py-6 text-center">
						<p class="text-sm text-muted-foreground">No pods match filter</p>
					</Card.Content>
				</Card.Root>
			{:else}
				<div class="space-y-2">
					{#each filteredAgents as agent (agent.pod_name)}
						{@const isSelected = selectedPods.has(agent.pod_name)}
						{@const isTerminated = agent.status === 'Succeeded' || agent.status === 'Failed'}
						{@const isRelaunching = relaunchingPods.has(agent.pod_name)}
						<div class={cn('flex items-center gap-2 rounded-lg bg-muted/30 p-2', isSelected && 'bg-muted/50')}>
							<Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(agent.pod_name)} />
							<div class={cn('h-2 w-2 rounded-full', statusColors[agent.status])} />
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium">{agent.pod_name}</div>
								<div class="flex gap-2 text-xs text-muted-foreground">
									<span>{agent.config_name}</span>
									<span>{formatTime(agent.started_at)}</span>
								</div>
							</div>
							<Button variant="ghost" size="sm" class="h-7 w-7 p-0" disabled={isRelaunching} on:click={() => relaunchPod(agent)}>
								<RotateCw class={cn('h-3.5 w-3.5', isRelaunching && 'animate-spin')} />
							</Button>
							<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-destructive" on:click={() => stopPod(agent.pod_name)}>
								{#if isTerminated}<Trash2 class="h-3.5 w-3.5" />{:else}<Square class="h-3.5 w-3.5" />{/if}
							</Button>
						</div>
					{/each}
				</div>
			{/if}

			<Button variant="outline" size="sm" on:click={() => agents.refresh()} class="w-full">
				<RefreshCw class="h-4 w-4" />
				Refresh
			</Button>
		</div>
	{/if}

	<!-- Configs Tab -->
	{#if activeTab === 'configs'}
		<div class="space-y-4">
			<Button on:click={() => goto('/configs/new')} class="w-full">
				<Plus class="h-4 w-4" />
				New Config
			</Button>

			{#if $configs.length === 0}
				<Card.Root>
					<Card.Content class="py-8 text-center">
						<FileText class="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">No configs yet</p>
					</Card.Content>
				</Card.Root>
			{:else}
				<div class="grid grid-cols-1 gap-3">
					{#each $configs as config (config.id)}
						<ConfigCard
							{config}
							on:launch={() => goto('/?launch=' + config.id)}
							on:edit={() => goto('/configs/' + config.id)}
							on:delete={() => handleDeleteConfig(config)}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
