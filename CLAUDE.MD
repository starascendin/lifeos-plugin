

## MONO repo instructions:
Context:
- I am the sole user of this stack.
- at this moment, i just run everything in DEV mode.
    - just use convex dev
    - and pnpm tauri dev
    
Goal:
- I want 1 place where:
    - all my data (professional and personal) lives in 1 place (the convex db). This is my lifeOS
    - AI agents can use all my data and work on them.
- I just want to speak/use AI agents, and it can use all my data as it see fits, to empower me in my:
    - professional life -- client management, project management, CRM, etc.
    - do e2e software development using AI (TBD)

Main Apps in this stack:
- the controlplane capacitor app -- i use this to config AI agents and use AI agents.
- the tauri LIFEOS apps


A ./apps/lifeos/taurireact-macapp
    - this is my tauri app. It has a simple webapp and it can be deployed to web (hosted on vercel) or I run it locally on my macair as tauri app
    - it has 2 apps:
        - 1. background sync job app -- this is just a tauri app where i can run a bunch of background things on my mac (sync mac voice memo notes, etc)
        - 2. LIFE OS app -- this is the main tauri app that i use. In there it has all my life os things like:
            - Project management -- clients, projects, phases, issues, etc.
            - agenda -- daily, weekly, monthly, etc
            - voice notes -- where i see/sync my mac's voice memos, i can transcribe and sync them to convex
    - i usually just run `pnpm tauri dev` 

B. ./packages/holaaiconvex
    - this is the main backend (convex). Now we are using just 1 project holaconvex-prod
    - we use CLERK AUTH to go w/ it.
    - i mostly just use the PROD url + PROD clerk all the time.
    - when a feature is done developing w/ ai, i usually just run `npx convex dev --once` and deploy directly to dev

B.1. ./packages/lifeos-mcp
    - this has MCP tools that has access to my LIFEOS convex data.
    - these are published to npm, so I can use them in other area as mcp and I can have AI agents access my lifeos data (see ./infra)

C. ./infra
    - this is my k3s stack that i deploy to hetzner.
    - in there, this is where i setup my AI army, using claude-code + opencode as main agent.
        - in there they all use a shared volume and share teh same credentials
    - the goal is to use claude-code and opencode as AI agents (for non-coding and coding) that use my personal subscriptions (claude max, codex pro, etc)
    - there is a "controlplane" app, and i build a capacitor app w/ it for my iphone use.
        - **IMPORTANT** this entire stack i use tailscale to connect to. Theres no AUTH; its only accessible via my tailscale
        - the controlplane capacitorapp is my main driver:
            - I use it to config AI Agents
            - I use an AGENT to use all my lifeOS data.

D. ./packages
    - everything else here, are my one off experiments.
    - beeper --  ./packages/beeperdb -- this is for my mac use, so i can scrape data from beeper, so i can see my chats in the tauri "beeper" tab.
    - granola ai -- this is a macos app that is the ai meeting note app. I may have some code to help me scrape data there and add it to my lifeos convex



## INSTRUCTIONS FOR DEVELOPMENT
DESIGN PRINCIPLES:
- we are using shadcn
- DESIGN THIS LIKE A SAAS PRODUCT, and use shadcn as much as possible like a saas product.
- STREAMLINE THE UX
- DO NOT OVER USE MODALS, ACCORDION CARDS, ETC.
    

- when starting a new feature, use worktrunk skill to create a new GIT WORK WORKTREE, then proceed to do what the user asks. 
    - when you created a new worktree, you can use pnpm env:decrypt to decrypt the environment variables for all apps and packages.

- this repo has react native
    - DO NOT UPDATE REACT NATIVE PACKAGE VERSIONS, IT MIGHT BREAK THE APP

- read CLERK_CONVEX_INSTRUCTION.MD and understand how clerk + convex is setup for all the envs

- for all convex AI development, read ai_notes/claude_instructions_AI_agent_code_DRY.md

- for all AI calls, we want to use vercel AI gateway as much as possible
    - the exception is GROQ for transcription, since it doesnt support streaming yet and vercel's AI Gateway doesn't support it. We need to use the GROQ API directly for transcription. Key is `GROQ_API_KEY` in the environment variables.



For Lifeos Tauri app, read:
- apps/lifeos/taurireact-macapp/CLAUDE.md

For any development in convex, make sure:
- all lint/build/ typecheck issues are corrected
- make sure you deploy to dev w/ `npx convex dev --once` command

For Voice Agent develop, read:
- ai_notes/ai-agent-tools-guide.md



!!! IMPORTANT !!!
- RAISE YOUR RIGHT HAND 🙋‍♂️ AND SWEAR YOU HAVE READ ALL THE INSTRUCTIONS IN THIS DOC, AND ALL THE OTHER DOCS I HAVE INSTRUCTED YOU TO READ. REPEAT THE INSTRUCTIONS OUT LOUD.