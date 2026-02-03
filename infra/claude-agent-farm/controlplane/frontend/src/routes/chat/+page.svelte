<script lang="ts">
	import { onMount, afterUpdate, onDestroy, tick } from 'svelte';
	import { page } from '$app/stores';
	import {
		Send,
		Plus,
		Server,
		Settings,
		History,
		Trash2,
		ChevronDown,
		Wrench,
		Bot,
		Info,
		Loader2
	} from 'lucide-svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import Button from '$lib/components/Button.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Sheet from '$lib/components/ui/sheet';
	import { cn } from '$lib/utils';
	import { chat, chatActions } from '$lib/stores/chat';
	import { configs } from '$lib/stores/configs';
	import { agents } from '$lib/stores/agents';
	import type { ChatThread, ToolCall, ServerConversation } from '$lib/api/types';

	let messageInput = '';
	let messagesContainer: HTMLElement;
	let showOptions = false;
	let showHistory = false;
	let showAgentSelector = false;
	let showInfoPanel = false;
	let skipPermissions = true;
	let streamJson = true;
	let selectedPreset: number | null = null;
	let shouldAutoScroll = true;
	let lastMessageCount = 0;

	// Only auto-scroll when user is near the bottom or new messages arrive from sending
	afterUpdate(() => {
		if (!messagesContainer) return;
		const newCount = $chat.messages.length;
		const isNewMessage = newCount > lastMessageCount;
		lastMessageCount = newCount;

		if (shouldAutoScroll || isNewMessage || $chat.isStreaming) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	function handleScroll() {
		if (!messagesContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
		// Consider "near bottom" if within 100px of the bottom
		shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
	}

	onMount(async () => {
		await configs.refresh();
		agents.startAutoRefresh(5000);
		chatActions.fetchConversations();

		// Auto-select agent from ?agent= query param
		const agentParam = $page.url.searchParams.get('agent');
		if (agentParam) {
			const config = $configs.find(
				(c) => (c.convex_id || String(c.id)) === agentParam
			);
			if (config) {
				chatActions.selectAgent(config.name, config.convex_id || config.id);
			}
		}
	});

	onDestroy(() => {
		agents.stopAutoRefresh();
	});

	$: runningAgents = ($agents || []).filter((a) => a.status === 'Running');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const message = messageInput.trim();
		if (!message || $chat.isStreaming) return;

		messageInput = '';
		chatActions.send(message, { skipPermissions, streamJson });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}

	function selectPreset(configId: number) {
		const config = $configs.find((c) => c.id === configId);
		if (config && config.task_prompt) {
			messageInput = config.task_prompt;
		}
		selectedPreset = configId;
	}

	function loadThread(thread: ChatThread) {
		chatActions.loadThread(thread);
		showHistory = false;
	}

	function deleteThread(e: Event, id: string) {
		e.stopPropagation();
		chatActions.deleteThread(id);
	}

	function loadServerConvo(convo: ServerConversation) {
		chatActions.loadServerConversation(convo);
		showHistory = false;
	}

	function deleteServerConvo(e: Event, id: string) {
		e.stopPropagation();
		chatActions.deleteServerConversation(id);
	}

	// Re-fetch conversations when sidebar opens
	$: if (showHistory) {
		chatActions.fetchConversations();
	}

	function getToolStatusColor(status: ToolCall['status']): string {
		switch (status) {
			case 'completed':
				return 'text-green-400';
			case 'error':
				return 'text-red-400';
			case 'running':
				return 'text-yellow-400 animate-pulse';
			default:
				return 'text-muted-foreground';
		}
	}

	const statusColors: Record<string, string> = {
		disconnected: 'bg-red-500',
		connecting: 'bg-yellow-500 animate-pulse',
		connected: 'bg-green-500'
	};

	$: statusTooltip = `${$chat.connectionStatus}${$chat.podName ? ` • ${$chat.podName}` : ''}${$chat.systemInfo?.model ? ` • ${$chat.systemInfo.model}` : ''}`;
</script>

<div class="chat-page-root">
	<!-- Thread History Sidebar -->
	<Sheet.Root bind:open={showHistory}>
		<Sheet.Content side="left" class="w-72 p-0 pt-safe">
			<div class="flex h-full flex-col">
				<Sheet.Header class="border-b px-4 py-3">
					<Sheet.Title>History</Sheet.Title>
				</Sheet.Header>
				<ScrollArea class="flex-1">
					{#if $chat.conversationsLoading}
						<div class="flex items-center justify-center p-4">
							<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					{:else if $chat.serverConversations.length === 0}
						<div class="p-4 text-center text-sm text-muted-foreground">No history</div>
					{:else}
						{#each $chat.serverConversations as convo}
							<button
								on:click={() => loadServerConvo(convo)}
								class={cn(
									'w-full border-b px-4 py-3 text-left transition-colors hover:bg-accent',
									$chat.threadId === convo.threadId && 'bg-accent'
								)}
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm">{convo.title || 'Untitled'}</p>
										<div class="mt-1 flex items-center gap-2">
											{#if convo.agentConfigName}
												<span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400">{convo.agentConfigName}</span>
											{/if}
											<span class="text-xs text-muted-foreground">
												{new Date(convo.updatedAt).toLocaleDateString()}
											</span>
										</div>
									</div>
									<button
										on:click={(e) => deleteServerConvo(e, convo._id)}
										class="p-1 text-muted-foreground hover:text-destructive"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</button>
						{/each}
					{/if}
				</ScrollArea>
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<!-- Main Chat Area -->
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Compact Header - Single Line -->
		<header class="flex-shrink-0 border-b bg-card px-3 py-2">
			<div class="flex items-center gap-2">
				<!-- Left: History + Agent Selector + Status -->
				<button
					on:click={() => (showHistory = !showHistory)}
					class={cn(
						'flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent',
						showHistory && 'bg-accent'
					)}
					title="History ({$chat.serverConversations.length})"
				>
					<History class="h-4 w-4" />
				</button>

				<!-- Agent Selector - Compact -->
				<div class="relative flex-1">
					<button
						on:click={() => (showAgentSelector = !showAgentSelector)}
						class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
					>
						<div class={cn('h-2 w-2 rounded-full', statusColors[$chat.connectionStatus])} title={statusTooltip} />
						<Bot class={cn('h-4 w-4', $chat.selectedAgentId ? 'text-blue-400' : 'text-muted-foreground')} />
						<span class="max-w-[120px] truncate text-sm sm:max-w-[200px]">
							{$chat.selectedAgent || 'Default'}
						</span>
						<ChevronDown class="h-3 w-3 text-muted-foreground" />
					</button>

					{#if showAgentSelector}
						<div class="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border bg-popover shadow-xl">
							<button
								on:click={() => { chatActions.selectAgent(null, null); showAgentSelector = false; }}
								class={cn(
									'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
									!$chat.selectedAgentId && 'bg-accent'
								)}
							>
								<Server class="h-4 w-4 text-muted-foreground" />
								<span>Default Chat Pod</span>
							</button>
							{#if $configs.length > 0}
								<div class="border-t" />
								{#each $configs as config}
									<button
										on:click={() => { chatActions.selectAgent(config.name, config.convex_id || config.id); showAgentSelector = false; }}
										class={cn(
											'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
											($chat.selectedAgentId === config.convex_id || $chat.selectedAgentId === config.id) && 'bg-accent'
										)}
									>
										<Bot class="h-4 w-4 text-blue-400" />
										<span class="truncate">{config.name}</span>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				<!-- Right: Info + Settings + New -->
				{#if $chat.systemInfo}
					<button
						on:click={() => (showInfoPanel = !showInfoPanel)}
						class={cn(
							'flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent',
							showInfoPanel && 'bg-accent'
						)}
						title="System info"
					>
						<Info class="h-4 w-4" />
					</button>
				{/if}

				<button
					on:click={() => (showOptions = !showOptions)}
					class={cn(
						'flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent',
						showOptions && 'bg-accent'
					)}
					title="Options"
				>
					<Settings class="h-4 w-4" />
				</button>

				<button
					on:click={() => chatActions.newThread()}
					class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
					title="New chat"
				>
					<Plus class="h-4 w-4" />
				</button>
			</div>

			<!-- Collapsible Info Panel -->
			{#if showInfoPanel && $chat.systemInfo}
				<div class="mt-2 rounded-lg bg-muted/50 p-3 text-xs">
					<div class="grid grid-cols-2 gap-2">
						<div><span class="text-muted-foreground">Model:</span> {$chat.systemInfo.model}</div>
						<div><span class="text-muted-foreground">Pod:</span> {$chat.podName || '-'}</div>
						<div class="col-span-2 truncate"><span class="text-muted-foreground">CWD:</span> <span class="font-mono">{$chat.systemInfo.cwd}</span></div>
						{#if $chat.systemInfo.mcp_servers?.length}
							<div class="col-span-2">
								<span class="text-muted-foreground">MCP:</span>
								{#each $chat.systemInfo.mcp_servers as s}
									<span class="ml-1 rounded bg-muted px-1.5 py-0.5">{s.name}</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Collapsible Options Panel -->
			{#if showOptions}
				<div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
					<label class="flex cursor-pointer items-center gap-1.5">
						<Checkbox bind:checked={skipPermissions} />
						<span>Skip perms</span>
					</label>
					<label class="flex cursor-pointer items-center gap-1.5">
						<Checkbox bind:checked={streamJson} />
						<span>Stream JSON</span>
					</label>
					{#if $configs.length > 0}
						<div class="h-4 w-px bg-border" />
						{#each $configs.slice(0, 3) as config}
							<button
								on:click={() => selectPreset(config.id)}
								class={cn(
									'rounded-full border px-2 py-0.5 text-xs transition-colors',
									selectedPreset === config.id
										? 'border-primary bg-primary text-primary-foreground'
										: 'border-border hover:bg-accent'
								)}
							>
								{config.name}
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</header>

		<!-- Messages -->
		<div bind:this={messagesContainer} on:scroll={handleScroll} class="flex-1 space-y-4 overflow-y-auto p-4">
			{#if $chat.messages.length === 0 && !$chat.isStreaming}
				<div class="flex h-full flex-col items-center justify-center px-4 text-center">
					<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
						<Send class="h-6 w-6 text-muted-foreground" />
					</div>
					<p class="text-muted-foreground">Send a message to start</p>
					{#if $chat.serverConversations.length > 0}
						<button
							on:click={() => (showHistory = true)}
							class="mt-3 text-sm text-blue-400 hover:text-blue-300"
						>
							View {$chat.serverConversations.length} previous chat{$chat.serverConversations.length > 1 ? 's' : ''}
						</button>
					{/if}
				</div>
			{:else}
				{#each $chat.messages as message}
					<ChatMessage {message} />
				{/each}

				<!-- Streaming tool calls -->
				{#if $chat.isStreaming && $chat.streamingToolCalls.length > 0}
					<div class="flex gap-3">
						<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
							<Wrench class="h-4 w-4 text-muted-foreground" />
						</div>
						<div class="flex-1 space-y-2">
							{#each $chat.streamingToolCalls as tool}
								<div class="rounded-lg border bg-card px-3 py-2">
									<div class="flex items-center gap-2">
										<div class={cn('h-2 w-2 rounded-full', getToolStatusColor(tool.status).replace('text-', 'bg-'))} />
										<span class="font-mono text-sm text-muted-foreground">{tool.name}</span>
										<span class="text-xs capitalize text-muted-foreground">{tool.status}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Streaming message -->
				{#if $chat.isStreaming && $chat.streamingContent}
					<ChatMessage
						message={{
							id: 'streaming',
							role: 'assistant',
							content: $chat.streamingContent,
							timestamp: new Date().toISOString(),
							toolCalls: $chat.streamingToolCalls.length > 0 ? $chat.streamingToolCalls : undefined
						}}
						streaming={true}
					/>
				{:else if $chat.isStreaming && $chat.streamingToolCalls.length === 0}
					<div class="flex gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
							<div class="flex gap-1">
								<div class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 0ms" />
								<div class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 150ms" />
								<div class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style="animation-delay: 300ms" />
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Error display -->
		{#if $chat.error}
			<div class="border-t border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
				{$chat.error}
			</div>
		{/if}

		<!-- Input -->
		<div class="flex-shrink-0 border-t bg-card p-3">
			<form on:submit={handleSubmit} class="flex gap-2">
				<Textarea
					bind:value={messageInput}
					on:keydown={handleKeydown}
					placeholder="Message..."
					disabled={$chat.isStreaming}
					rows={1}
					class="min-h-[44px] max-h-[150px] flex-1 resize-none"
				/>
				{#if $chat.isStreaming}
					<Button type="button" variant="destructive" size="icon" class="h-11 w-11 flex-shrink-0" on:click={() => chatActions.stop()}>
						<div class="h-4 w-4 rounded-sm bg-white" />
					</Button>
				{:else}
					<Button type="submit" size="icon" class="h-11 w-11 flex-shrink-0" disabled={!messageInput.trim()}>
						<Send class="h-5 w-5" />
					</Button>
				{/if}
			</form>
		</div>
	</div>
</div>

<style>
	.chat-page-root {
		display: flex;
		position: fixed;
		top: env(safe-area-inset-top);
		left: 0;
		right: 0;
		/* 4.25rem = bottom nav content height, plus safe area */
		bottom: calc(4.25rem + env(safe-area-inset-bottom));
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.chat-page-root {
			top: 0;
			left: 16rem;
			bottom: 0;
		}
	}
</style>
