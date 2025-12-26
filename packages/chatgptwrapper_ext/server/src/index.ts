/**
 * Council Server entry point.
 *
 * Run with: npm run dev (or pnpm dev)
 */

import { createCouncilServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3456', 10);

const { start } = createCouncilServer(PORT);
start();
