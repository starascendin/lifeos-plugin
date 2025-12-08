In this repo, this is how I setup clerk and convex:


Clerk:
- i have 1 clerk app "holaai":
    - development env -- for both DEV AND STAGING (in the holaaiconvex-staging convex project)
    - production env -- for production (in the holaconvex-prod convex project)


Convex:
- it uses 2 PROJECTS:
    - holaaiconvex-staging (packages/holaaiconvex)
        - beaming-giraffe-300 -- dev cloud  (MY DEV ENV)
        - adorable-firefly-704 -- production cloud (MY STAGINIG ENV)
    - holaconvex-prod (packages/holaaiconvex_prod)
        - keen-nightingale-310 -- dev cloud (NOT USED)
        - production id -- agreeable-ibex-949 (MY PRODUCTION ENV)
    - holaaiconvex-staging and holaconvex-prod should have same parity based on the git workflow dev -> staging -> prod (main branch)