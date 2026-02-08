<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Download,
		Trash2,
		Server,
		ChevronDown,
		ChevronRight,
		Save,
		Check,
		RefreshCw,
		Sparkles,
		Plus,
		Pencil,
		Smartphone
	} from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import {
		getTomlConfigs,
		getTomlConfig,
		createTomlConfig,
		updateTomlConfig,
		deleteTomlConfig,
		getActiveServers,
		getSystemInfo,
		type SystemInfo
	} from '$lib/api/client';
	import type { MCPTomlConfig, MCPServer, Skill } from '$lib/api/types';
	import { skills, skillsByCategory, categoryLabels } from '$lib/stores/skills';
	import {
		isNative,
		getCurrentBundle,
		fetchLatestVersion,
		downloadAndApply,
		type CurrentBundleInfo,
		type LatestVersionInfo
	} from '$lib/capacitor/updater';

	// Tab state - show App first on mobile (native), MCP first on web
	type Tab = 'app' | 'mcp' | 'skills';
	let activeTab: Tab = isNative ? 'app' : 'mcp';

	// App/Update state
	let currentBundle: CurrentBundleInfo | null = null;
	let latestVersion: LatestVersionInfo | null = null;
	let checkingUpdate = false;
	let downloadingUpdate = false;
	let downloadProgress = 0;
	let updateError = '';
	let systemInfo: SystemInfo | null = null;
	let systemInfoError = '';

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

	// App/Update functions
	async function loadAppInfo() {
		try {
			systemInfo = await getSystemInfo();
			systemInfoError = '';
		} catch (e) {
			console.error('Failed to load system info:', e);
			systemInfoError = e instanceof Error ? e.message : 'Failed to load';
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

	onMount(() => {
		loadSavedConfigs();
		loadActiveServers();
		skills.refresh();
		loadAppInfo();
	});

	// Tab definitions - conditionally show App tab only on native
	$: tabs = [
		...(isNative ? [{ key: 'app' as Tab, label: 'App', icon: Smartphone }] : []),
		{ key: 'mcp' as Tab, label: 'MCP', icon: Server },
		{ key: 'skills' as Tab, label: 'Skills', icon: Sparkles }
	];

	// Build timestamp (same as sidebar)
	function formatBuildTime(iso: string): string {
		try {
			const date = new Date(iso);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso.slice(0, 16).replace('T', ' ');
		}
	}
	const buildTime = formatBuildTime(__BUILD_TIMESTAMP__);
</script>

<div class="space-y-4 p-4 md:p-6">
	<!-- Header -->
	<div>
		<h1 class="text-xl font-bold sm:text-2xl">Settings</h1>
		<p class="text-sm text-muted-foreground">Manage your agent farm</p>
	</div>

	<!-- Backend Info - Always visible -->
	<Card.Root>
		<Card.Header class="pb-3">
			<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
				Backend
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-2">
			{#if systemInfoError}
				<div class="text-xs text-destructive">{systemInfoError}</div>
			{:else if systemInfo}
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Image Version</span>
					<Badge variant="outline" class="font-mono">
						v{systemInfo.version}
					</Badge>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Storage</span>
					<Badge variant={systemInfo.storage_type === 'convex' ? 'default' : 'secondary'}>
						{systemInfo.storage_type}
					</Badge>
				</div>
				{#if systemInfo.convex_url}
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm text-muted-foreground">Convex</span>
						<span class="truncate text-xs font-mono text-foreground/80">{systemInfo.convex_url}</span>
					</div>
				{/if}
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">K8s</span>
					<Badge variant={systemInfo.k8s_enabled ? 'default' : 'secondary'} class={systemInfo.k8s_enabled ? 'bg-green-600/20 text-green-400' : ''}>
						{systemInfo.k8s_enabled ? 'Connected' : 'Off'}
					</Badge>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">GitHub</span>
					<Badge variant={systemInfo.github_enabled ? 'default' : 'secondary'} class={systemInfo.github_enabled ? 'bg-green-600/20 text-green-400' : ''}>
						{systemInfo.github_enabled ? 'Connected' : 'Off'}
					</Badge>
				</div>
			{:else}
				<div class="text-xs text-muted-foreground">Loading...</div>
			{/if}
		</Card.Content>
	</Card.Root>

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
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Build</span>
								<span class="text-xs text-muted-foreground">{buildTime}</span>
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
</div>
