/**
 * Council Server entry point.
 *
 * Run with: pnpm dev (or npm run dev)
 */

import { createCouncilServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3456', 10);

const { start } = createCouncilServer(PORT);
start();
