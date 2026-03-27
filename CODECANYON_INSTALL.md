# PumpPilot - Codecanyon Install Guide

This guide is for a clean first install.

## A. Server Requirements

- Node.js 20+
- npm 10+
- MongoDB URI
- HTTPS domain (recommended for production)

## B. Upload Files

Upload project files (exclude heavy folders if possible):

- Exclude `.next`
- Exclude `node_modules`
- Exclude local `.env.local`

## C. Environment Variables

Create `.env.local` from `.env.example`.

Minimum required:

- `MONGODB_URI`
- `NEXTAUTH_SECRET` (32+ chars)
- `MOBILE_JWT_SECRET` (32+ chars)
- `ESP32_DEVICE_SECRET`
- `NEXTAUTH_URL`
- `APP_BASE_URL`
- `SEED_MASTER_PASSWORD` (for first seed)

## D. Install and Setup

Run:

```bash
npm install
npm run db:setup
```

If you want demo data:

```bash
SEED_DEMO_DATA=true npm run db:seed
```

## E. Start App

```bash
npm run build
npm run start
```

## F. Idempotent Maintenance Commands

Use anytime:

```bash
npm run install:check
npm run db:migrate
npm run db:seed
```

`npm run db:migrate` now also hashes any legacy plaintext account passwords before login.

## G. Common Errors

1. `Missing MONGODB_URI`
   - Add `MONGODB_URI` to `.env.local`
2. `NEXTAUTH_SECRET must be at least 32 characters`
   - Set longer random secret
3. Mongo connection failed
   - Check URI/IP whitelist and DB user permissions

## H. Security Baseline

- Self-service password reset is disabled. Users must sign in and change passwords from their dashboard.
- Web and mobile login now require bcrypt-hashed passwords; older plaintext records must be migrated before use.
- Use strong secrets and unique DB credentials.
- Never commit `.env.local` to git.
- `npm run build`, `npm run start`, and `npm run install:check` fail if critical env values are missing or still use placeholder secrets.
