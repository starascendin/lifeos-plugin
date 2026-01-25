<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Home, MessageSquare, Settings, Bot, FileText, Download } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { initUpdater, onUpdateStatus, type UpdateInfo } from '$lib/capacitor';

	const navItems = [
		{ path: '/', label: 'Home', icon: Home },
		{ path: '/chat', label: 'Chat', icon: MessageSquare },
		{ path: '/configs', label: 'Configs', icon: FileText },
		{ path: '/settings', label: 'Settings', icon: Settings }
	];

	let updateInfo: UpdateInfo = { hasUpdate: false };

	onMount(() => {
		// Initialize Capacitor updater (no-op on web)
		initUpdater();

		// Subscribe to update status
		const unsubscribe = onUpdateStatus((info) => {
			updateInfo = info;
		});

		return unsubscribe;
	});

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

<!-- Desktop Sidebar -->
<aside class="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card md:block">
	<div class="flex h-full flex-col px-3 py-4">
		<!-- Logo -->
		<div class="mb-4 border-b pb-4">
			<div class="flex items-center gap-2">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
					<Bot class="h-6 w-6" />
				</div>
				<div>
					<h1 class="text-lg font-bold">Agent Farm</h1>
					<p class="text-xs text-muted-foreground">Control Plane</p>
				</div>
			</div>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1">
			{#each navItems as item}
				<a
					href={item.path}
					class={cn(
						'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
						$page.url.pathname === item.path
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
					)}
				>
					<svelte:component this={item.icon} class="h-5 w-5" />
					<span class="font-medium">{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Status indicator -->
		<div class="space-y-2">
			<div class="rounded-lg bg-muted p-3">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500" />
					<span>Connected to cluster</span>
				</div>
			</div>
			{#if updateInfo.hasUpdate}
				<div class="rounded-lg bg-blue-500/10 p-3">
					<div class="flex items-center gap-2 text-sm text-blue-400">
						<Download class="h-4 w-4" />
						{#if updateInfo.downloading}
							<span>Updating... {updateInfo.progress ?? 0}%</span>
						{:else}
							<span>Update ready</span>
						{/if}
					</div>
				</div>
			{/if}
			<div class="px-3 py-2 text-xs text-muted-foreground">
				Build: {buildTime}
			</div>
		</div>
	</div>
</aside>

<!-- Mobile Bottom Navigation -->
<nav class="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden safe-area-bottom">
	<div class="flex items-center justify-around">
		{#each navItems as item}
			<a
				href={item.path}
				class={cn(
					'flex flex-1 flex-col items-center gap-1 py-3 transition-colors',
					$page.url.pathname === item.path
						? 'text-primary'
						: 'text-muted-foreground'
				)}
			>
				<svelte:component this={item.icon} class="h-6 w-6" />
				<span class="text-xs font-medium">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>

<!-- Main content -->
<main class="min-h-screen pb-20 pt-safe md:ml-64 md:pb-0 md:pt-0">
	<slot />
</main>
