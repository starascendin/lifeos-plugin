<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowLeft,
		Download,
		Trash2,
		Server,
		ChevronDown,
		ChevronRight,
		Save,
		FileText,
		Check,
		RefreshCw
	} from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils';
	import {
		getTomlConfigs,
		getTomlConfig,
		createTomlConfig,
		updateTomlConfig,
		deleteTomlConfig,
		getActiveServers
	} from '$lib/api/client';
	import type { MCPTomlConfig, MCPServer } from '$lib/api/types';

	let tomlContent = '';
	let importError = '';
	let importSuccess = '';

	// JSON converter state
	let jsonContent = '';
	let converting = false;
	let jsonConverterOpen = false;
	let convertError = '';

	// Saved TOML configs
	let savedConfigs: MCPTomlConfig[] = [];
	let selectedConfig: string = '';
	let newConfigName = '';
	let savingConfig = false;
	let showSaveAs = false;

	// Active servers (computed from enabled configs)
	let activeServers: MCPServer[] = [];
	let loadingServers = false;

	// Cache clearing
	let clearingCache = false;
	let cacheMessage = '';

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

	onMount(() => {
		loadSavedConfigs();
		loadActiveServers();
	});

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
</script>

<div class="space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div>
		<h1 class="text-xl font-bold sm:text-2xl">Settings</h1>
		<p class="text-sm text-muted-foreground">Configure MCP servers and app settings</p>
	</div>

	<!-- MCP Servers Section -->
	<div class="flex items-center gap-2">
		<Server class="h-5 w-5 text-muted-foreground" />
		<h2 class="text-lg font-semibold">MCP Servers</h2>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Left: Config Management -->
		<div class="space-y-4 lg:col-span-2">
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
							+ New Config
						</button>
					</div>
				</Card.Header>
				<Card.Content>
					{#if savedConfigs.length === 0}
						<p class="py-4 text-center text-sm text-muted-foreground">No saved configs yet</p>
					{:else}
						<ScrollArea class="h-48">
							<div class="space-y-2">
								{#each savedConfigs as config (config.name)}
									<div
										class="flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
									>
										<button
											on:click={() => loadConfig(config.name)}
											class={cn(
												'flex flex-1 items-center gap-2 text-left',
												selectedConfig === config.name ? 'text-blue-400' : ''
											)}
										>
											<FileText class="h-4 w-4 text-blue-400" />
											<span class="font-medium">{config.name}</span>
											{#if config.is_default}
												<span class="text-xs text-muted-foreground">(default)</span>
											{/if}
										</button>

										{#if !config.is_default}
											<button
												on:click|stopPropagation={() => deleteConfig(config.name)}
												class="p-1.5 text-muted-foreground transition-colors hover:text-destructive"
												title="Delete config"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										{/if}
									</div>
								{/each}
							</div>
						</ScrollArea>
					{/if}

					{#if showSaveAs}
						<div class="mt-4 flex gap-2 border-t pt-4">
							<Input
								type="text"
								bind:value={newConfigName}
								placeholder="New config name..."
								class="flex-1"
								on:keydown={(e) => e.key === 'Enter' && tomlContent && saveCurrentConfig()}
							/>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- TOML Editor -->
			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center justify-between">
						<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
							{selectedConfig
								? `Editing: ${selectedConfig}`
								: showSaveAs && newConfigName
									? `New: ${newConfigName}`
									: 'TOML Editor'}
						</Card.Title>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8"
							on:click={downloadToml}
							disabled={!tomlContent.trim()}
						>
							<Download class="h-4 w-4" />
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="space-y-3">
					<Textarea
						bind:value={tomlContent}
						rows={12}
						class="font-mono text-sm"
						placeholder={`# Click a config above to edit, or create a new one

[servers.example]
command = "npx"
args = ["-y", "@anthropic/mcp-server-example"]
description = "Example MCP server"`}
					/>

					{#if importError}
						<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
							{importError}
						</div>
					{/if}

					{#if importSuccess}
						<div
							class="flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/30 p-3 text-sm text-green-400"
						>
							<Check class="h-4 w-4" />
							{importSuccess}
						</div>
					{/if}

					{#if tomlContent.trim() && (selectedConfig || newConfigName)}
						<div class="flex justify-end">
							<Button on:click={saveCurrentConfig} loading={savingConfig}>
								<Save class="h-4 w-4" />
								{selectedConfig ? 'Save Changes' : 'Create Config'}
							</Button>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- JSON to TOML Converter (Collapsed) -->
			<Card.Root>
				<Collapsible.Root bind:open={jsonConverterOpen}>
					<Collapsible.Trigger class="w-full">
						<Card.Header class="flex-row items-center justify-between pb-3">
							<Card.Title class="text-sm text-muted-foreground">Convert JSON to TOML</Card.Title>
							{#if jsonConverterOpen}
								<ChevronDown class="h-4 w-4 text-muted-foreground" />
							{:else}
								<ChevronRight class="h-4 w-4 text-muted-foreground" />
							{/if}
						</Card.Header>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<Card.Content class="space-y-3 pt-0">
							<Textarea
								bind:value={jsonContent}
								rows={8}
								class="font-mono text-sm"
								placeholder={`{
  "mcpServers": {
    "example": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}`}
							/>

							{#if convertError}
								<div
									class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
								>
									{convertError}
								</div>
							{/if}

							<div class="flex justify-end">
								<Button
									on:click={handleConvertJson}
									loading={converting}
									disabled={!jsonContent.trim()}
									size="sm"
								>
									Convert to TOML
								</Button>
							</div>
						</Card.Content>
					</Collapsible.Content>
				</Collapsible.Root>
			</Card.Root>
		</div>

		<!-- Right: Active Servers & Help -->
		<div class="space-y-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center justify-between">
						<Card.Title class="text-sm uppercase tracking-wide text-muted-foreground">
							Active Servers
						</Card.Title>
						<span class="rounded-full bg-green-600/20 px-2 py-0.5 text-sm font-medium text-green-400">
							{activeServers.length}
						</span>
					</div>
					<p class="text-xs text-muted-foreground">Available MCP servers from saved configs</p>
				</Card.Header>
				<Card.Content>
					{#if loadingServers}
						<div class="py-6 text-center">
							<div
								class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
							></div>
						</div>
					{:else if activeServers.length === 0}
						<div class="py-6 text-center">
							<Server class="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
							<p class="text-sm text-muted-foreground">No active servers</p>
							<p class="mt-1 text-xs text-muted-foreground/70">Create a config to add servers</p>
						</div>
					{:else}
						<ScrollArea class="h-72">
							<div class="space-y-2">
								{#each activeServers as server (server.name)}
									<div class="rounded-lg bg-muted/50 p-3">
										<div class="flex items-center gap-2">
											<div class="h-2 w-2 rounded-full bg-green-500"></div>
											<span class="text-sm font-medium">{server.name}</span>
										</div>
										{#if server.description}
											<p class="ml-4 mt-1 text-xs text-muted-foreground">{server.description}</p>
										{/if}
										<div class="ml-4 mt-1 truncate font-mono text-xs text-muted-foreground/70">
											{server.command}
											{JSON.parse(server.args || '[]')
												.slice(0, 2)
												.join(' ')}{JSON.parse(server.args || '[]').length > 2 ? '...' : ''}
										</div>
									</div>
								{/each}
							</div>
						</ScrollArea>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-sm text-muted-foreground">How it works</Card.Title>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-1.5 text-xs text-muted-foreground">
						<li>1. Create or edit TOML configs with your MCP servers</li>
						<li>2. Active Servers shows all available servers</li>
						<li>3. Agents get access to active servers</li>
					</ul>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-sm text-muted-foreground">Environment Variables</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="mb-2 text-xs text-muted-foreground">
						Use <code class="rounded bg-muted px-1">${'{VAR}'}</code> syntax:
					</p>
					<div class="space-y-0.5 font-mono text-xs text-muted-foreground/70">
						<div>GITHUB_PAT</div>
						<div>ANTHROPIC_API_KEY</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-sm text-muted-foreground">MCP Cache</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3">
					<p class="text-xs text-muted-foreground">
						Clear npx cache on agent pods to fetch latest MCP package versions.
					</p>
					<Button
						on:click={clearMCPCache}
						loading={clearingCache}
						variant="outline"
						size="sm"
						class="w-full"
					>
						<RefreshCw class="h-4 w-4" />
						Clear MCP Cache
					</Button>
					{#if cacheMessage}
						<p class="text-xs text-center text-muted-foreground">{cacheMessage}</p>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
