# The Ledger — Daily Wisdom

A local web app that serves one investment quote per day with memo.

## Setup

1. **Get an OpenRouter key** at [openrouter.ai/keys](https://openrouter.ai/keys). Memos use only free models: `api/memo.js` fetches OpenRouter's live model list on each cold start (cached 1h), keeps models priced at $0, tries the newest first, and falls back to the next if one fails. No manual rotation needed.

2. **Copy the config template:**

   ```
   cp config.example.js config.js
   ```

3. **Add your key** — open `config.js` and replace `YOUR_OPENROUTER_KEY_HERE` with your actual key

4. **Open `index.html`** in your browser — that's it

## File structure

```
the-ledger/
├── index.html          # Main app
├── config.js           # Your API key — NEVER commit this
├── config.example.js   # Safe template — commit this
├── .gitignore          # Keeps config.js out of git
└── README.md
```

## GitHub safety

`config.js` is listed in `.gitignore`. Git will never track it.
Only `config.example.js` (which has no real key) gets committed.

To verify nothing sensitive will be committed:

```
git status
```

`config.js` should not appear in the output.
