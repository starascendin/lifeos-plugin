In this repo, this is how I setup clerk and convex:


Clerk:
- i have 1 clerk app "holaai":
    - development env -- for DEV (in the holaconvex-prod project, keen-nightingale-310)
    - production env -- for PRODUCTION (in the holaconvex-prod project, agreeable-ibex-949)


Convex:
- 1 CODEBASE (packages/holaaiconvex) deploys to 1 PROJECT (holaconvex-prod):
    - keen-nightingale-310 -- dev cloud (MY DEV ENV)
        - deploy: `pnpm --filter @holaai/convex dev` or `npx convex dev --once`
    - agreeable-ibex-949 -- production cloud (MY PRODUCTION ENV)
        - deploy: `pnpm --filter @holaai/convex deploy:prod`


Vercel:
- 1 app "holaai-tanstack"
    - environment:
        - preview -- for dev branch
        - production -- for main branch
