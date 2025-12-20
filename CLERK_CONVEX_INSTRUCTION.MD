In this repo, this is how I setup clerk and convex:


Clerk:
- i have 1 clerk app "holaai":
    - development env -- for both DEV AND STAGING (in the holaaiconvex-staging convex project)
    - production env -- for production (in the holaconvex-prod convex project)


Convex:
- 1 CODEBASE (packages/holaaiconvex) deploys to 2 PROJECTS:
    - holaaiconvex-staging project:
        - beaming-giraffe-300 -- dev cloud  (MY DEV ENV)
        - adorable-firefly-704 -- production cloud (MY STAGING ENV)
        - deploy: `pnpm --filter @holaai/convex dev` or `pnpm --filter @holaai/convex deploy`
    - holaconvex-prod project:
        - keen-nightingale-310 -- dev cloud (NOT USED)
        - agreeable-ibex-949 -- production cloud (MY PRODUCTION ENV)
        - deploy: `pnpm --filter @holaai/convex deploy:prod`


Vercel:
- 1 app "holaai-tanstack"
    - environment:
        - preview -- for dev branch
        - staging -- for staging branch
        - production -- for main branch