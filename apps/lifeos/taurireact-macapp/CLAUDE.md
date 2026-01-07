This is my Lifeos app
- in there there are 2 apps:
    - background sync job app 
        - used in tauri.
        - this is the background job app, that pulls data from my youtube playlist and also my apple screentime, notes, etc.
        - goal:
            - this app exist bc i wanted a way to sync all my persoanl data (from yt, screentime, notes) into 1 place, so i can use them later in other ways.
            - all AI related features (transcribing, groq, llm, etc) should all be using CONVEX Action
    - lifeos app
        - can be used as standalone TAURI app AND vercel webapp
        - when developing, we assume webapp paradigm FIRST. Tauri is secondary.
        - ALL AI features (llm, transcription, etc) should assume using CONVEX + webapp first.
        

- the LifeOS Tauri app:
    - the background jobs app IS ALWAYS tauri app.
    - the Life OS app can be BOTH BOTH tauri app AND a web app (deployed on vercel)
        - make sure whatever you do, it can handle both webapp + tauri

- for the RUST part, make sure you CHECK LINT and fix any issues
- use shadcn ui component has much as possible


