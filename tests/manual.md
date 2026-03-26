# PumpPilot Manual Test Plan

## Prereqs
- `.env.local` set with `MONGODB_URI`, `NEXTAUTH_SECRET`, `MOBILE_JWT_SECRET`, `ESP32_DEVICE_SECRET`, `CRON_SECRET`, `NEXTAUTH_URL`, and `APP_BASE_URL`.
- Run `npm install` then `npm run dev`.

## Flow 1: Admin registration and approval
1. `POST /api/admin/register` with `{ "username": "rahim", "password": "secret12" }` → success pending.
2. Sign in as master admin (once created) at `/admin/login`.
3. Visit `/master/admins` → approve `rahim`.
4. `GET /api/admin/list-active` includes `rahim`.

## Flow 2: User registration
1. `POST /api/user/register` with active `adminId` and `{ "username": "userA", "password": "secret12" }` → success.

## Flow 3: Auth login
1. User login at `/user/login` with `userA/secret12` → redirected to dashboard.

## Flow 4: Motor start/stop
1. On dashboard, set minutes and click Start → expect RUNNING/WAITING response.
2. `curl -X POST /api/motor/stop` with userId cookie session → returns used/refunded.
3. `GET /api/esp32/poll?adminId=<adminId>&userId=<userId>` reflects status/remaining.

## Route sanity checks
- `/master/admins` remains accessible for authenticated master users and loads pending approvals instead of redirecting away
- Mobile app routes unauthenticated users to `LoginScreen` and authenticated users directly to their role dashboard with no orphaned home screen

## Health checks
- Mobile admin user management: create user succeeds, user appears after refresh, delete requires confirmation in UI and removes the user from the list
- Mobile master management: create admin succeeds with pending or active status, create user under an active admin succeeds, recharge increases balance, and set balance overwrites minutes without going negative
- Minute-request dedupe: first request succeeds, second pending request from web or mobile returns `400` with `Pending request already exists`
- `POST /api/auth/change-password` while signed out -> `401`; with wrong current password -> `400`; with valid current password and new password -> success
- Mobile `POST /api/mobile/auth/logout` or `POST /api/mobile/auth/logout-all` -> the previous access token should fail on the next protected mobile API call with `401`
- `GET /api/internal/tick` without `x-cron-key` -> `401`, with missing `CRON_SECRET` -> `503`, with valid `x-cron-key` -> `{ ok: true }`
- `npm run install:check` -> fails if critical env values are missing or still use placeholders
- `GET /api/health/db` → `{ ok: true }`
- `GET /api/health/queue` → queue counts

Log any failures from server console for troubleshooting.
