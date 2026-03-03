# PumpPilot Manual Test Plan

## Prereqs
- `.env.local` set with `MONGODB_URI` and `NEXTAUTH_SECRET`.
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

## Health checks
- `GET /api/health/db` → `{ ok: true }`
- `GET /api/health/queue` → queue counts

Log any failures from server console for troubleshooting.
