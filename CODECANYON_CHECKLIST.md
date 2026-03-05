# PumpPilot - Codecanyon Packaging Checklist

Use this checklist before creating the final upload ZIP.

## 1) Security & Config

- [ ] `.env.local` is **not** included in package
- [ ] `.env.example` exists and is updated
- [ ] No real DB URI, API keys, or private tokens in code/docs
- [ ] `NEXTAUTH_SECRET` policy documented (32+ chars)
- [ ] Rate-limit and auth lockout features documented

## 2) Installer & Database

- [ ] `npm run install:check` passes
- [ ] `npm run db:migrate` passes on clean DB
- [ ] `npm run db:seed` passes with `SEED_MASTER_PASSWORD`
- [ ] `npm run db:setup` runs end-to-end successfully
- [ ] Migration and seed are idempotent (safe to rerun)

## 3) Build & Runtime

- [ ] `npm run build` passes
- [ ] `npm run start` works in production mode
- [ ] Login flows (master/admin/user) verified
- [ ] Core pump flow verified (start/stop/queue/recharge/hold)

## 4) Documentation

- [ ] `README.md` contains setup and run steps
- [ ] `CODECANYON_INSTALL.md` contains buyer install guide
- [ ] Beginner guide and technical docs are linked from home
- [ ] Troubleshooting section included

## 5) Packaging Content

- [ ] Exclude `.git`, `.next`, `node_modules`, local dumps/logs
- [ ] Include source code + docs + `.env.example`
- [ ] Include ESP32 firmware files
- [ ] Include clear folder structure for buyer

## 6) Marketplace Ready

- [ ] Version number updated
- [ ] Changelog updated
- [ ] Demo URL working (if provided)
- [ ] Screenshots/video prepared
- [ ] Support policy included

## Final Gate (Pass/Fail)

- [ ] PASS all sections above

