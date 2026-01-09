# Inspiration Saver Chrome Extension

A Chrome extension to save webpages as inspiration links with notes and tags, using Clerk for authentication and Convex for storage.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

Run in watch mode:
```bash
pnpm dev
```

## Icons

Create icon files in `public/icons/`:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

You can use a tool like Figma or an icon generator to create these.

## Environment Variables

- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `VITE_CONVEX_URL` - Convex deployment URL

## Features

- Save current page with notes
- Add tags to organize inspirations
- View and filter saved inspirations
- Delete saved items
