Decisions:
- 1 mono repo for holaai + life os? or 1 for holaai and 1 for life os? 
    - [DECISION - 1 mono repo] case for 1 main repo -- easy to manage. I guess i can have all the diff apps in the same repo, and they can have diff UIs.
        - they prob all share many similar components, like livekit, voice capability, etc. If i do this, just need to make sure each one are clearly defined and separated
        - hola ai -- convexbackend + rnapp + tanstack -- these are 1 thing
    - so in order to reduce complexity, i will have 1 main backend (convex) for all holaai + life os things, so i dont have to maintain so many things. In order to do this correctly, i need to encapsulate and organize my code correclty:
        - convex backend:
            - schema, functions should be app based -- for holaai, lifeos, etc.
        - in webapp, rn app -- they should mirror the "apps" structure of convex, and have components or UI that reflects it.
            - for sidebar, they should be organized by apps
            - feature flagging:
                - user should only see what "apps" they are supposed to see
            - if we need to, we can separate out individual "web/rn" app for each "app" but use a common convex backend/ai things
        - [] I liked the way laravel organizes its code. Perhpas we can setup something similar for convex?



what do i want this monorepo to be about?
1. HolaAI -- app to help me learn spanish effectively
    Apps:
    - [x] RN app -- for my ios, livekit voice agent, dynamic generated lessons.
    - [x] web app 

2. my lifeos app -- an app to help me organize everything in my life:
    - Meta:
        - my 10 year management (End year 2036)
        - DREAMS, what do i want to achieve in 10 years?
            1) financial freedom and wealth. Mutli revenue streams.
                - Inversions:
                    - failure is having no ops / assets to produce revenue streams
            2) I have a family, i'm a father, i have children
            3) I'm really thriving -- doing thing love and enjoy, for the peole and cause i care about, and with people/comrades/companions i jibe with
    - things: 
        - people/client management. 
        - Use AI to help me manage projects, tasks, reviews, etc.
        - voice memo
    - Apps
        - RN app -- so i can real time chat