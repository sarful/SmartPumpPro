# PumpPilot Buyer Quick Start

## 1) Requirements
- Node.js 20+
- MongoDB URI

## 2) Setup
1. Copy `.env.example` -> `.env.local`
2. Set required vars:
   - `MONGODB_URI`
   - `NEXTAUTH_SECRET`
   - `MOBILE_JWT_SECRET`
   - `ESP32_DEVICE_SECRET`
   - `CRON_SECRET`
   - `NEXTAUTH_URL`
   - `APP_BASE_URL`
   - `SEED_MASTER_PASSWORD`

## 3) Install
```bash
npm install
npm run db:setup
```

`npm run db:setup` includes the password migration step, so any older plaintext account records are converted to bcrypt hashes automatically.

## 4) Run
```bash
npm run build
npm run start
```

## 5) Login
- Master login with seeded master account
- Approve admin registrations (if manual approval enabled)
- Admin creates/users recharges
- Users operate motor

For detailed setup: `CODECANYON_INSTALL.md`.
