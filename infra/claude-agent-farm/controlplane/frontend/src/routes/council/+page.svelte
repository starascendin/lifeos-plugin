<script lang="ts">
	import { onMount } from 'svelte';
	import { Send, RotateCcw, Crown, Loader2, CheckCircle, AlertCircle, Play, RefreshCw, Zap, Sparkles, Plus, Minus, History, Trash2, X } from 'lucide-svelte';
	import { marked } from 'marked';
	import Button from '$lib/components/Button.svelte';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils';
	import { council, councilActions, type CouncilSession } from '$lib/stores/council';

	let questionInput = '';
	let selectedStage = 1;
	let selectedProvider: string | null = null;
	let selectedSynthesisChairman: string | null = null;
	let showHistory = false;

	// Configure marked for safe rendering
	marked.setOptions({ breaks: true, gfm: true });

	onMount(() => {
		councilActions.loadProviders();
		councilActions.checkPodStatus();
	});

	$: podRunning = $council.podStatus.status === 'running';
	$: responsesArray = Array.from($council.responses.values());

	$: if (responsesArray.length > 0 && !selectedProvider) {
		selectedProvider = responsesArray[0].provider_id;
	}

	$: {
		if ($council.stage === 'deliberating') selectedStage = 1;
		else if ($council.stage === 'reviewing') selectedStage = 2;
		else if ($council.stage === 'synthesizing' || $council.stage === 'done') selectedStage = 3;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!questionInput.trim() || !podRunning) return;
		selectedProvider = null;
		selectedSynthesisChairman = null;
		councilActions.ask(questionInput.trim());
	}

	function getStageStatus(stage: number): 'pending' | 'active' | 'done' {
		const s = $council.stage;
		if (s === 'idle') return 'pending';
		if (stage === 1) return s === 'deliberating' ? 'active' : ['reviewing', 'synthesizing', 'done'].includes(s) ? 'done' : 'pending';
		if (stage === 2) return s === 'reviewing' ? 'active' : ['synthesizing', 'done'].includes(s) ? 'done' : 'pending';
		if (stage === 3) return s === 'synthesizing' ? 'active' : s === 'done' ? 'done' : 'pending';
		return 'pending';
	}

	function getRank(providerId: string): number | null {
		if (!$council.peerReviews?.length) return null;
		let total = 0, count = 0;
		for (const r of $council.peerReviews) {
			if (r.rankings?.[providerId]) { total += r.rankings[providerId]; count++; }
		}
		return count > 0 ? Math.round(total / count) : null;
	}

	function renderMarkdown(text: string): string {
		return marked(text) as string;
	}

	function scoreColor(score: number): string {
		if (score >= 4) return 'text-green-600';
		if (score <= 2) return 'text-red-500';
		return 'text-muted-foreground';
	}

	$: selectedResponse = selectedProvider ? $council.responses.get(selectedProvider) : null;
	$: selectedReview = selectedProvider ? $council.peerReviews.find(r => r.ranker_id === selectedProvider) : null;

	// Auto-select first synthesis chairman when syntheses arrive
	$: synthesesArray = Array.from($council.syntheses.values());
	$: if (synthesesArray.length > 0 && !selectedSynthesisChairman) {
		selectedSynthesisChairman = synthesesArray[0].chairman_id;
	}
	$: selectedSynthesis = selectedSynthesisChairman ? $council.syntheses.get(selectedSynthesisChairman) : null;

	// Sorted sessions (newest first)
	$: sortedSessions = [...$council.sessions].reverse();

	function formatDate(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const mins = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString();
	}

	function handleLoadSession(session: CouncilSession) {
		councilActions.loadSession(session);
		showHistory = false;
		selectedProvider = session.responses[0]?.provider_id || null;
		selectedSynthesisChairman = session.syntheses[0]?.chairman_id || null;
	}
</script>

<div class="flex h-[calc(100vh-56px)] flex-col md:h-screen">
	<!-- Header -->
	<div class="flex items-center gap-2 border-b bg-card px-2 py-1.5">
		<span class="font-semibold text-sm">LLM Council</span>
		<div class="flex items-center gap-1 ml-auto">
			<Button size="sm" variant="ghost" class={cn('h-6 w-6 p-0 relative', showHistory && 'bg-muted')} on:click={() => showHistory = !showHistory}>
				<History class="h-3 w-3" />
				{#if $council.sessions.length > 0}
					<span class="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">{$council.sessions.length}</span>
				{/if}
			</Button>
			{#if $council.podLoading}
				<Loader2 class="h-3 w-3 animate-spin" />
			{:else}
				<div class={cn('h-2 w-2 rounded-full', podRunning ? 'bg-green-500' : 'bg-red-500')} />
			{/if}
			{#if !podRunning && !$council.podLoading}
				<Button size="sm" variant="default" class="h-6 px-2 text-xs" on:click={() => councilActions.launchPod()}>
					<Play class="h-3 w-3" />
				</Button>
			{:else if podRunning}
				<Button size="sm" variant="ghost" class="h-6 w-6 p-0" on:click={() => councilActions.refreshPod()} disabled={$council.podLoading}>
					<RefreshCw class={cn('h-3 w-3', $council.podLoading && 'animate-spin')} />
				</Button>
			{/if}
			{#if $council.stage === 'done' || $council.stage === 'error'}
				<Button size="sm" variant="ghost" class="h-6 w-6 p-0" on:click={() => councilActions.reset()}>
					<RotateCcw class="h-3 w-3" />
				</Button>
			{/if}
		</div>
	</div>

	<!-- Main -->
	<div class="flex flex-1 overflow-hidden relative">
		<!-- History Panel (overlay) -->
		{#if showHistory}
			<div class="absolute inset-0 z-10 bg-background flex flex-col">
				<div class="flex items-center justify-between border-b px-2 py-1.5">
					<span class="text-sm font-medium">History ({$council.sessions.length})</span>
					<div class="flex items-center gap-1">
						{#if $council.sessions.length > 0}
							<Button size="sm" variant="ghost" class="h-6 px-2 text-xs text-destructive" on:click={() => councilActions.clearAllSessions()}>
								Clear All
							</Button>
						{/if}
						<Button size="sm" variant="ghost" class="h-6 w-6 p-0" on:click={() => showHistory = false}>
							<X class="h-3 w-3" />
						</Button>
					</div>
				</div>
				<ScrollArea class="flex-1">
					<div class="p-2 space-y-1">
						{#if sortedSessions.length === 0}
							<p class="text-center text-xs text-muted-foreground py-8">No history yet</p>
						{:else}
							{#each sortedSessions as session (session.id)}
								<div
									class={cn('group flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50 transition-colors',
										$council.currentSessionId === session.id && 'border-primary bg-primary/5')}
									on:click={() => handleLoadSession(session)}
									on:keydown={(e) => e.key === 'Enter' && handleLoadSession(session)}
									role="button"
									tabindex="0"
								>
									<div class="flex-1 min-w-0">
										<p class="text-sm line-clamp-2">{session.question}</p>
										<div class="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
											<span>{formatDate(session.createdAt)}</span>
											<span class="capitalize">{session.tier}</span>
											<span>{session.providerIds.length} models</span>
										</div>
									</div>
									<button
										class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity"
										on:click|stopPropagation={() => councilActions.deleteSession(session.id)}
									>
										<Trash2 class="h-3 w-3" />
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</ScrollArea>
			</div>
		{/if}

		<!-- Stage Sidebar -->
		{#if $council.stage !== 'idle'}
			<div class="flex flex-col gap-1 p-1 border-r bg-muted/30">
				{#each [1, 2, 3] as stage}
					{@const status = getStageStatus(stage)}
					<button
						class={cn('w-1.5 flex-1 rounded-full transition-all',
							selectedStage === stage && 'w-2',
							status === 'done' && 'bg-green-500',
							status === 'active' && 'bg-primary animate-pulse',
							status === 'pending' && 'bg-muted-foreground/20')}
						on:click={() => selectedStage = stage}
					/>
				{/each}
			</div>
		{/if}

		<ScrollArea class="flex-1">
			<div class="p-2 space-y-2">
				<!-- Idle -->
				{#if $council.stage === 'idle'}
					<div class="flex items-center gap-2">
						<div class="flex rounded-full bg-muted p-0.5">
							<button
								class={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
									$council.tier === 'normal' ? 'bg-background shadow-sm' : 'text-muted-foreground')}
								on:click={() => councilActions.setTier('normal')}
							><Zap class="h-3 w-3" />Fast</button>
							<button
								class={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
									$council.tier === 'pro' ? 'bg-background shadow-sm text-amber-600' : 'text-muted-foreground')}
								on:click={() => councilActions.setTier('pro')}
							><Sparkles class="h-3 w-3" />Pro</button>
						</div>
					</div>

					<div class="flex gap-1">
						{#each $council.tierProviders as p}
							<button
								class={cn('flex-1 flex items-center justify-center gap-1 rounded border py-1.5 text-xs transition-colors',
									$council.selectedProviders.has(p.id) ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground')}
								on:click={() => councilActions.toggleProvider(p.id)}
							>
								{p.name}
								{#if $council.chairman === p.id}<Crown class="h-3 w-3 text-amber-500" />{/if}
							</button>
						{/each}
					</div>

					{#if $council.selectedProviders.size > 1}
						<div class="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
							<Crown class="h-3 w-3 text-amber-500" />Chairs:
							{#each $council.tierProviders.filter(p => $council.selectedProviders.has(p.id)) as p}
								<button
									class={cn('px-1.5 py-0.5 rounded transition-colors', $council.chairmen.has(p.id) ? 'bg-amber-500/20 text-amber-600 font-medium' : 'hover:bg-muted')}
									on:click={() => councilActions.toggleChairman(p.id)}
								>{p.name.split(' ')[0]}</button>
							{/each}
							<span class="text-muted-foreground/50">({$council.chairmen.size})</span>
						</div>
					{/if}

					<form on:submit={handleSubmit}>
						<Textarea bind:value={questionInput} placeholder="Ask..." class="min-h-[60px] resize-none text-sm"
							on:keydown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && handleSubmit(e)} />
						<Button type="submit" class="w-full mt-2 h-8" disabled={!questionInput.trim() || !podRunning || $council.selectedProviders.size < 2}>
							<Send class="h-3 w-3 mr-1" />Ask
						</Button>
					</form>
				{/if}

				<!-- Active -->
				{#if $council.stage !== 'idle'}
					{#if $council.question}
						<p class="text-xs text-muted-foreground line-clamp-1 border-l-2 border-primary pl-2">{$council.question}</p>
					{/if}

					<!-- Stage 1: Responses -->
					{#if selectedStage === 1 && (responsesArray.length > 0 || $council.activeProviders.size > 0)}
						<div class="flex gap-1">
							{#each $council.tierProviders.filter(p => $council.selectedProviders.has(p.id)) as p}
								{@const res = $council.responses.get(p.id)}
								{@const active = $council.activeProviders.has(p.id)}
								{@const rank = getRank(p.id)}
								<button
									class={cn('flex-1 flex items-center justify-center gap-1 rounded border py-1 text-xs',
										selectedProvider === p.id ? 'border-primary bg-primary/10' : 'border-transparent bg-muted',
										!res && !active && 'opacity-50')}
									on:click={() => selectedProvider = p.id}
								>
									{#if active && !res}<Loader2 class="h-3 w-3 animate-spin" />
									{:else if res?.error}<AlertCircle class="h-3 w-3 text-destructive" />
									{:else if res}<CheckCircle class="h-3 w-3 text-green-500" />{/if}
									{p.name.split(' ')[0]}
									{#if rank}<span class="text-[10px] text-muted-foreground">#{rank}</span>{/if}
								</button>
							{/each}
						</div>
						{#if selectedResponse}
							<div class={cn('rounded border p-2', selectedResponse.error && 'border-destructive')}>
								{#if selectedResponse.error}
									<p class="text-sm text-destructive">{selectedResponse.error}</p>
								{:else}
									<div class="prose prose-sm dark:prose-invert max-w-none">
										{@html renderMarkdown(selectedResponse.response)}
									</div>
								{/if}
							</div>
						{:else if $council.activeProviders.size > 0}
							<div class="flex items-center justify-center py-6"><Loader2 class="h-4 w-4 animate-spin" /></div>
						{/if}
					{/if}

					<!-- Stage 2: Peer Review -->
					{#if selectedStage === 2}
						{#if $council.peerReviews?.length > 0}
							<div class="flex gap-1">
								{#each $council.peerReviews as review}
									{@const reviewer = $council.providers.find(p => p.id === review.ranker_id)}
									<button
										class={cn('flex-1 flex items-center justify-center gap-1 rounded border py-1 text-xs',
											selectedProvider === review.ranker_id ? 'border-primary bg-primary/10' : 'border-transparent bg-muted')}
										on:click={() => selectedProvider = review.ranker_id}
									>
										<CheckCircle class="h-3 w-3 text-green-500" />
										{reviewer?.name.split(' ')[0] || review.ranker_id}
									</button>
								{/each}
							</div>

							{#if selectedReview}
								<div class="space-y-2">
									{#each Object.entries(selectedReview.rankings).sort((a, b) => a[1] - b[1]) as [pid, rank]}
										{@const prov = $council.providers.find(p => p.id === pid)}
										{@const score = selectedReview.scores?.[pid]}
										<div class="rounded border p-2">
											<div class="flex items-center gap-2 mb-2">
												<span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{rank}</span>
												<span class="text-sm font-medium">{prov?.name || pid}</span>
												{#if score}<span class="text-xs text-muted-foreground ml-auto">{score.total}/20</span>{/if}
											</div>
											{#if score}
												<!-- Dimension Scores -->
												<div class="grid grid-cols-4 gap-1 text-xs mb-2">
													<div class="text-center">
														<div class={scoreColor(score.accuracy)}>{score.accuracy}</div>
														<div class="text-[10px] text-muted-foreground">Accuracy</div>
													</div>
													<div class="text-center">
														<div class={scoreColor(score.completeness)}>{score.completeness}</div>
														<div class="text-[10px] text-muted-foreground">Complete</div>
													</div>
													<div class="text-center">
														<div class={scoreColor(score.clarity)}>{score.clarity}</div>
														<div class="text-[10px] text-muted-foreground">Clarity</div>
													</div>
													<div class="text-center">
														<div class={scoreColor(score.insight)}>{score.insight}</div>
														<div class="text-[10px] text-muted-foreground">Insight</div>
													</div>
												</div>
												<!-- Pros/Cons -->
												{#if score.pros?.length || score.cons?.length}
													<div class="space-y-1 text-xs">
														{#if score.pros?.length}
															{#each score.pros as pro}
																<div class="flex items-start gap-1 text-green-600">
																	<Plus class="h-3 w-3 mt-0.5 flex-shrink-0" />{pro}
																</div>
															{/each}
														{/if}
														{#if score.cons?.length}
															{#each score.cons as con}
																<div class="flex items-start gap-1 text-red-500">
																	<Minus class="h-3 w-3 mt-0.5 flex-shrink-0" />{con}
																</div>
															{/each}
														{/if}
													</div>
												{/if}
											{/if}
										</div>
									{/each}
									{#if selectedReview.reasoning}
										<p class="text-xs text-muted-foreground border-t pt-2">{selectedReview.reasoning}</p>
									{/if}
								</div>
							{/if}
						{:else if $council.stage === 'reviewing'}
							<div class="flex items-center justify-center py-6"><Loader2 class="h-4 w-4 animate-spin" /></div>
						{:else}
							<p class="text-center text-xs text-muted-foreground py-6">No reviews</p>
						{/if}
					{/if}

					<!-- Stage 3: Synthesis (Multiple Chairmen) -->
					{#if selectedStage === 3}
						<!-- Chairman tabs when multiple -->
						{#if $council.chairmen.size > 1 || synthesesArray.length > 1}
							<div class="flex gap-1 mb-2">
								{#each [...$council.chairmen] as cid}
									{@const syn = $council.syntheses.get(cid)}
									{@const prov = $council.providers.find(p => p.id === cid)}
									{@const isSynthesizing = $council.activeSynthesizers.has(cid)}
									<button
										class={cn('flex-1 flex items-center justify-center gap-1 rounded border py-1 text-xs transition-colors',
											selectedSynthesisChairman === cid ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-transparent bg-muted',
											!syn && !isSynthesizing && 'opacity-50')}
										on:click={() => selectedSynthesisChairman = cid}
									>
										{#if isSynthesizing && !syn}<Loader2 class="h-3 w-3 animate-spin" />
										{:else if syn?.error}<AlertCircle class="h-3 w-3 text-destructive" />
										{:else if syn}<Crown class="h-3 w-3 text-amber-500" />{/if}
										{prov?.name.split(' ')[0] || cid}
									</button>
								{/each}
							</div>
						{/if}

						<!-- Selected synthesis content -->
						<div class="rounded border border-primary bg-primary/5 p-2">
							<div class="flex items-center gap-1 mb-1 text-sm font-medium">
								<Crown class="h-3 w-3 text-amber-500" />
								{#if selectedSynthesis}
									{selectedSynthesis.chairman_name}
								{:else}
									Synthesis
								{/if}
								{#if $council.activeSynthesizers.size > 0}<Loader2 class="h-3 w-3 animate-spin ml-auto" />{/if}
							</div>
							{#if selectedSynthesis?.error}
								<p class="text-sm text-destructive">{selectedSynthesis.error}</p>
							{:else if selectedSynthesis?.synthesis}
								<div class="prose prose-sm dark:prose-invert max-w-none">
									{@html renderMarkdown(selectedSynthesis.synthesis)}
								</div>
							{:else if $council.stage === 'synthesizing' || $council.activeSynthesizers.size > 0}
								<div class="flex items-center justify-center py-4"><Loader2 class="h-4 w-4 animate-spin" /></div>
							{:else}
								<p class="text-center text-xs text-muted-foreground py-4">No synthesis available</p>
							{/if}
						</div>
					{/if}

					{#if $council.error}
						<div class="rounded border border-destructive p-2 flex items-center gap-1 text-destructive text-sm">
							<AlertCircle class="h-3 w-3" />{$council.error}
						</div>
					{/if}
				{/if}
			</div>
		</ScrollArea>
	</div>
</div>

<style>
	:global(.prose) {
		font-size: 0.875rem;
		line-height: 1.5;
	}
	:global(.prose p) {
		margin: 0.5em 0;
	}
	:global(.prose ul, .prose ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}
	:global(.prose code) {
		font-size: 0.8em;
		padding: 0.1em 0.3em;
		background: hsl(var(--muted));
		border-radius: 0.25em;
	}
	:global(.prose pre) {
		margin: 0.5em 0;
		padding: 0.5em;
		background: hsl(var(--muted));
		border-radius: 0.375em;
		overflow-x: auto;
	}
	:global(.prose pre code) {
		padding: 0;
		background: none;
	}
</style>
