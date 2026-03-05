# PumpPilot - Final Submission Folder Structure

Recommended ZIP root:

```text
PumpPilot/
  web/
    app/
    components/
    hooks/
    lib/
    models/
    public/
    esp32/
    types/
    scripts/
    package.json
    package-lock.json
    next.config.ts
    tsconfig.json
    postcss.config.mjs
    eslint.config.mjs
    .gitignore
    .env.example
    README.md
    CODECANYON_INSTALL.md
    CODECANYON_CHECKLIST.md
  docs/
    buyer-quick-start.md
```

## Must Exclude

- `.git/`
- `.next/`
- `node_modules/`
- `.env.local`
- any private backup/db dump/log files

## Optional (if you sell mobile separately)

```text
PumpPilot-Mobile/
  source/
  docs/
```

If mobile app is sold as one bundle with web, clearly separate folders and docs.

