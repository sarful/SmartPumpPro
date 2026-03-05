# PumpPilot Web (Next.js)

PumpPilot is a multi-tenant smart motor control platform (web backend + dashboard) for Admin/User/Master workflows, wallet billing, queue, load-shedding safety, and ESP32 polling.

## Requirements

- Node.js 20+ (recommended)
- npm 10+
- MongoDB Atlas or self-hosted MongoDB 6+

## 1) Environment Setup

Copy `.env.example` to `.env.local` and set your values:

```bash
cp .env.example .env.local
```

Required:

- `MONGODB_URI`
- `NEXTAUTH_SECRET` (min 32 chars)

## 2) Install Dependencies

```bash
npm install
```

## 3) Clean Install Flow (Codecanyon-ready)

Run full setup:

```bash
npm run db:setup
```

This executes:

1. `npm run install:check` -> validates env and DB connectivity
2. `npm run db:migrate` -> creates/refreshes core indexes
3. `npm run db:seed` -> creates master admin + global settings (idempotent)

## 4) Run App

Development:

```bash
npm run dev
```

Production:

```bash
npm run build
npm run start
```

## Seeder Notes

Seeder env options:

- `SEED_MASTER_USERNAME` (default: `master`)
- `SEED_MASTER_PASSWORD` (**required**, min 8 chars)
- `SEED_DEMO_DATA` (`true/false`, default `false`)

Seeder is idempotent (safe to run again).

## Extra Docs

- Codecanyon install: `CODECANYON_INSTALL.md`
- Packaging checklist: `CODECANYON_CHECKLIST.md`
- Packaging structure: `CODECANYON_PACKAGE_STRUCTURE.md`

## Codecanyon Package Build

Prepare clean buyer package:

```bash
npm run package:codecanyon
```

Output folder:

`dist/codecanyon/PumpPilot`
