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
- `SEED_MASTER_PASSWORD` (for first seed)

Recommended:

- `NEXTAUTH_URL`
- `APP_BASE_URL`

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

## G. Common Errors

1. `Missing MONGODB_URI`
   - Add `MONGODB_URI` to `.env.local`
2. `NEXTAUTH_SECRET must be at least 32 characters`
   - Set longer random secret
3. Mongo connection failed
   - Check URI/IP whitelist and DB user permissions

## H. Security Baseline

- Keep `ENABLE_PASSWORD_RESET_API=false` unless required.
- Use strong secrets and unique DB credentials.
- Never commit `.env.local` to git.

