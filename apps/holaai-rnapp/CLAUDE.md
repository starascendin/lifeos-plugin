IN this react native, here are some rules:

- for ANY AI calls, we must create CUSTOM components (card, hooks, etc, ) to make all calls to AI with a standard, re-usable ui component. The actual app UI then uses these custom components


This way, we can easily swap out AI provider, or update UI easily.