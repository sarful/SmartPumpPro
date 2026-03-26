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
- `MOBILE_JWT_SECRET` (min 32 chars, used for mobile tokens)
- `ESP32_DEVICE_SECRET` (shared secret required by `/api/esp32/poll`)
- `CRON_SECRET` (required by `/api/internal/tick`)
- `NEXTAUTH_URL`
- `APP_BASE_URL`

Device note:

- Every ESP32 firmware client must send the `x-device-key` header with the same `ESP32_DEVICE_SECRET` value.

Scheduler note:

- Every scheduler call to `/api/internal/tick` must send the `x-cron-key` header with the same `CRON_SECRET` value.

Password note:

- Public self-service password reset is disabled.
- Signed-in users can change their password from their role dashboard.

Validation note:

- `npm run build`, `npm run start`, and `npm run install:check` now fail fast if critical env values are missing or still use placeholder secrets.

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

Password storage:

- Web and mobile authentication require bcrypt-hashed passwords.
- `npm run db:migrate` hashes any legacy plaintext account passwords before login compatibility is removed.

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

## Quality Gates

- Run `npm run lint -- .` to lint the maintained web source tree.
- Run `npm run typecheck` in `smartpump-pro` and `smartpump-mobile` before release work.
- Run `npm run release:validate` before a production deploy.
- Generated buyer-package output under `dist/` and packaging scripts under `scripts/` are excluded from the main web lint gate so source quality checks stay focused on maintained app code.
- Cross-platform release validation notes live in `../RELEASE_VALIDATION.md`.

## Observability

- Server-side incidents are persisted in `incident_logs` with source, route, request ID, platform, and metadata.
- Mobile can report global crash/error events to `POST /api/mobile/client-log`.
- Masters can inspect recent incidents through `GET /api/master/incidents`.
