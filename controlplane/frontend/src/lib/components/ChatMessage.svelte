<script lang="ts">
	import { Bot, User, Wrench, Check, AlertCircle, ChevronDown, ChevronRight, Copy, CheckCheck } from 'lucide-svelte';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { cn } from '$lib/utils';
	import type { ChatMessage, ToolCall } from '$lib/api/types';

	export let message: ChatMessage;
	export let streaming = false;

	let expandedTools: Set<string> = new Set();
	let copiedId: string | null = null;

	function toggleTool(id: string) {
		if (expandedTools.has(id)) {
			expandedTools.delete(id);
		} else {
			expandedTools.add(id);
		}
		expandedTools = expandedTools;
	}

	function copyToClipboard(text: string, id: string) {
		navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => copiedId = null, 2000);
	}

	function renderMarkdown(content: string): string {
		if (!content) return '';

		// Escape HTML first
		let html = content
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Code blocks (must be before inline code)
		html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
			const langLabel = lang ? `<span class="absolute top-2 right-2 text-xs text-muted-foreground/50">${lang}</span>` : '';
			return `<div class="relative"><pre class="bg-zinc-900 rounded-lg p-4 my-3 overflow-x-auto border border-zinc-800">${langLabel}<code class="text-sm text-zinc-300 font-mono">${code.trim()}</code></pre></div>`;
		});

		// Inline code
		html = html.replace(
			/`([^`]+)`/g,
			'<code class="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
		);

		// Bold
		html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');

		// Italic
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');

		// Headers (must check for line start)
		html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2 text-zinc-100">$1</h3>');
		html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2 text-zinc-100">$1</h2>');
		html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-5 mb-3 text-zinc-100">$1</h1>');

		// Links
		html = html.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" class="text-blue-400 hover:text-blue-300 hover:underline" target="_blank" rel="noopener">$1</a>'
		);

		// Unordered lists
		html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-zinc-300">$1</li>');

		// Ordered lists
		html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-zinc-300">$1</li>');

		// Wrap consecutive list items
		html = html.replace(/(<li class="ml-4 list-disc[^>]*>[\s\S]*?<\/li>\n?)+/g, '<ul class="my-2 space-y-1">$&</ul>');
		html = html.replace(/(<li class="ml-4 list-decimal[^>]*>[\s\S]*?<\/li>\n?)+/g, '<ol class="my-2 space-y-1">$&</ol>');

		// Blockquotes
		html = html.replace(
			/^&gt; (.+)$/gm,
			'<blockquote class="border-l-4 border-zinc-600 pl-4 my-3 text-zinc-400 italic">$1</blockquote>'
		);

		// Horizontal rules
		html = html.replace(/^---$/gm, '<hr class="my-4 border-zinc-700">');

		// Convert newlines to breaks (but not inside code blocks or after block elements)
		html = html.replace(/\n(?!<)/g, '<br>');

		// Clean up extra breaks after block elements
		html = html.replace(/<\/(h[123]|ul|ol|pre|blockquote|div)><br>/g, '</$1>');
		html = html.replace(/<br><(h[123]|ul|ol|pre|blockquote)/g, '<$1');

		return html;
	}

	function formatToolInput(input: Record<string, unknown>): string {
		try {
			return JSON.stringify(input, null, 2);
		} catch {
			return String(input);
		}
	}

	function getToolStatusIcon(status: ToolCall['status']) {
		switch (status) {
			case 'completed':
				return Check;
			case 'error':
				return AlertCircle;
			default:
				return Wrench;
		}
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

	function getToolBgColor(status: ToolCall['status']): string {
		switch (status) {
			case 'completed':
				return 'bg-green-500/10 border-green-500/20';
			case 'error':
				return 'bg-red-500/10 border-red-500/20';
			case 'running':
				return 'bg-yellow-500/10 border-yellow-500/20';
			default:
				return 'bg-muted/50 border-border';
		}
	}

	$: isUser = message.role === 'user';
	$: hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
</script>

<div class={cn('flex gap-3', isUser && 'flex-row-reverse')}>
	<div class="flex-shrink-0">
		<div
			class={cn(
				'flex h-8 w-8 items-center justify-center rounded-full',
				isUser ? 'bg-primary' : 'bg-zinc-800'
			)}
		>
			{#if isUser}
				<User class="h-4 w-4" />
			{:else}
				<Bot class="h-4 w-4 text-zinc-300" />
			{/if}
		</div>
	</div>

	<div class={cn('max-w-[85%] flex-1', isUser && 'flex flex-col items-end')}>
		{#if hasToolCalls && !isUser}
			<div class="mb-3 space-y-2">
				{#each message.toolCalls as tool}
					<Collapsible.Root
						open={expandedTools.has(tool.id)}
						class={cn('overflow-hidden rounded-lg border', getToolBgColor(tool.status))}
					>
						<Collapsible.Trigger
							class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
							on:click={() => toggleTool(tool.id)}
						>
							<svelte:component
								this={getToolStatusIcon(tool.status)}
								class={cn('h-4 w-4 flex-shrink-0', getToolStatusColor(tool.status))}
							/>
							<span class="flex-1 truncate font-mono text-sm text-zinc-300">{tool.name}</span>
							<span class={cn('text-xs capitalize', getToolStatusColor(tool.status))}>{tool.status}</span>
							{#if expandedTools.has(tool.id)}
								<ChevronDown class="h-4 w-4 text-muted-foreground flex-shrink-0" />
							{:else}
								<ChevronRight class="h-4 w-4 text-muted-foreground flex-shrink-0" />
							{/if}
						</Collapsible.Trigger>
						<Collapsible.Content class="border-t border-white/5">
							<div class="px-3 py-2">
								<div class="flex items-center justify-between mb-1">
									<span class="text-xs text-muted-foreground uppercase tracking-wide">Input</span>
									<button
										on:click={() => copyToClipboard(formatToolInput(tool.input), tool.id + '-input')}
										class="p-1 text-muted-foreground hover:text-foreground transition-colors"
									>
										{#if copiedId === tool.id + '-input'}
											<CheckCheck class="h-3 w-3 text-green-400" />
										{:else}
											<Copy class="h-3 w-3" />
										{/if}
									</button>
								</div>
								<pre class="bg-zinc-900/50 rounded p-2 overflow-x-auto text-xs text-zinc-400 font-mono max-h-48 overflow-y-auto">{formatToolInput(tool.input)}</pre>
							</div>
							{#if tool.result}
								<div class="border-t border-white/5 px-3 py-2">
									<div class="flex items-center justify-between mb-1">
										<span class="text-xs text-muted-foreground uppercase tracking-wide">Result</span>
										<button
											on:click={() => copyToClipboard(tool.result || '', tool.id + '-result')}
											class="p-1 text-muted-foreground hover:text-foreground transition-colors"
										>
											{#if copiedId === tool.id + '-result'}
												<CheckCheck class="h-3 w-3 text-green-400" />
											{:else}
												<Copy class="h-3 w-3" />
											{/if}
										</button>
									</div>
									<pre class="bg-zinc-900/50 rounded p-2 overflow-x-auto text-xs text-zinc-400 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">{tool.result}</pre>
								</div>
							{/if}
						</Collapsible.Content>
					</Collapsible.Root>
				{/each}
			</div>
		{/if}

		{#if message.content}
			<div
				class={cn(
					'inline-block rounded-2xl px-4 py-3',
					isUser
						? 'rounded-tr-sm bg-primary text-primary-foreground'
						: 'rounded-tl-sm bg-zinc-800/80 text-zinc-100',
					streaming && 'streaming-cursor'
				)}
			>
				{#if isUser}
					<p class="whitespace-pre-wrap">{message.content}</p>
				{:else}
					<div class="markdown-content prose prose-invert prose-sm max-w-none">
						{@html renderMarkdown(message.content)}
					</div>
				{/if}
			</div>
		{/if}

		{#if message.timestamp}
			<div class={cn('mt-1 text-xs text-muted-foreground', isUser && 'text-right')}>
				{new Date(message.timestamp).toLocaleTimeString()}
			</div>
		{/if}
	</div>
</div>
