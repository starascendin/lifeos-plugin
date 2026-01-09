- when starting a new feature, use worktrunk skill to create a new GIT WORK WORKTREE, then proceed to do what the user asks. 

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