MONO repo instructions:
Context:
- I am the sole user of this stack.
- I just want a SEAMLESS dev exp, where:
    - i just run everything on prod urls, since im the only user.
    - i just deploy everything to prod w/ `pnpm deploy:prod:isolated --yes`

A ./apps/lifeos/taurireact-macapp
    - this is my tauri app. It has a simple webapp and it can be deployed to web (hosted on vercel) or I run it locally on my macair as tauri app
    - it has 2 apps:
        - 1. background sync job app -- this is just a tauri app where i can run a bunch of background things on my mac (sync mac voice memo notes, etc)
        - 2. LIFE OS app -- this is the main tauri app that i use. In there it has all my life os things like:
            - Project management -- clients, projects, phases, issues, etc.
            - agenda -- daily, weekly, monthly, etc
            - voice notes -- where i see/sync my mac's voice memos, i can transcribe and sync them to convex
    - i usually just run `pnpm tauri:dev:production` 

B. ./packages/holaaiconvex
    - this is the main backend (convex). Now we are using just 1 project holaconvex-prod
    - we use CLERK AUTH to go w/ it.
    - i mostly just use the PROD url + PROD clerk all the time.
    - when a feature is done developing w/ ai, i usually just run `pnpm deploy:prod:isolated --yes   ` and deploy directly to prod

C. 



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