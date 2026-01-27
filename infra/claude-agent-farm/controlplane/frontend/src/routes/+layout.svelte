<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Home, MessageSquare, Settings, Bot, FileText, Download, Container, Users } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { initUpdater, onUpdateStatus, initAppState, onAppStateChange, type UpdateInfo } from '$lib/capacitor';

	// Mobile nav - simplified to 4 tabs
	const mobileNavItems = [
		{ path: '/', label: 'Home', icon: Home },
		{ path: '/chat', label: 'Chat', icon: MessageSquare },
		{ path: '/council', label: 'Council', icon: Users },
		{ path: '/settings', label: 'Settings', icon: Settings }
	];

	// Desktop nav - all items
	const desktopNavItems = [
		{ path: '/', label: 'Home', icon: Home },
		{ path: '/pods', label: 'Pods', icon: Container },
		{ path: '/chat', label: 'Chat', icon: MessageSquare },
		{ path: '/council', label: 'Council', icon: Users },
		{ path: '/configs', label: 'Configs', icon: FileText },
		{ path: '/settings', label: 'Settings', icon: Settings }
	];

	let updateInfo: UpdateInfo = { hasUpdate: false };
	let isConnected = true;

	onMount(() => {
		// Initialize Capacitor updater (no-op on web)
		initUpdater();

		// Initialize app state handling (background/foreground)
		initAppState();

		// Subscribe to update status
		const unsubscribeUpdates = onUpdateStatus((info) => {
			updateInfo = info;
		});

		// Handle app state changes (background/foreground)
		const unsubscribeAppState = onAppStateChange((isActive) => {
			if (isActive) {
				console.log('[Layout] App returned to foreground, triggering reconnect');
				// Dispatch custom event for pages to reconnect their APIs
				window.dispatchEvent(new CustomEvent('app-foreground'));
				isConnected = true;
			} else {
				console.log('[Layout] App went to background');
				window.dispatchEvent(new CustomEvent('app-background'));
			}
		});

		return () => {
			unsubscribeUpdates();
			unsubscribeAppState();
		};
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

<style>
	/* App shell that covers entire viewport including safe areas */
	.app-shell {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		background: hsl(var(--background));
	}

	/* Top safe area spacer - covers the notch */
	.top-safe-area {
		flex-shrink: 0;
		height: env(safe-area-inset-top);
		background: hsl(var(--background));
	}

	/* Main content area between safe areas */
	.main-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	/* Scrollable content */
	.scroll-content {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		/* Leave space for bottom nav on mobile */
		padding-bottom: calc(4rem + env(safe-area-inset-bottom));
	}

	/* Bottom navigation - fixed at bottom */
	.bottom-nav {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: hsl(var(--card));
		border-top: 1px solid hsl(var(--border));
		/* Extend into safe area */
		padding-bottom: env(safe-area-inset-bottom);
	}

	/* Extra background extension for iOS overscroll at bottom */
	.bottom-nav::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		height: 100px;
		background: hsl(var(--card));
	}

	/* Desktop adjustments */
	@media (min-width: 768px) {
		.top-safe-area {
			display: none;
		}
		.scroll-content {
			padding-bottom: 0;
			margin-left: 16rem;
		}
		.bottom-nav {
			display: none;
		}
	}
</style>

<!-- App Shell -->
<div class="app-shell">
	<!-- Top safe area (notch cover) - mobile only -->
	<div class="top-safe-area md:hidden"></div>

	<!-- Desktop Sidebar -->
	<aside class="fixed left-0 top-0 z-40 hidden h-full w-64 border-r bg-card md:block">
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
				{#each desktopNavItems as item}
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

	<!-- Main content area -->
	<div class="main-area">
		<!-- Scrollable content -->
		<main class="scroll-content">
			<slot />
		</main>

		<!-- Mobile Bottom Navigation -->
		<nav class="bottom-nav md:hidden">
			<div class="flex items-center justify-around">
				{#each mobileNavItems as item}
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
	</div>
</div>
