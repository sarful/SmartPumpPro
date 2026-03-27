# Unified Billing Refactor Tasklist

## Goal

Make `web` mode and `RFID` mode use the same minute-deduction process, with the same stop rule:

- stop when `availableMinutes <= 5`
- avoid relying on a separate RFID-only billing path
- avoid requiring `/api/internal/tick` for normal billing behavior

## Current Status

- [x] Analyze current billing flow
- [x] Add a unified minute engine
- [x] Wire unified engine into live routes
- [x] Reduce `/api/internal/tick` to compatibility/backup use
- [x] Pass TypeScript typecheck
- [ ] Verify web runtime behavior
- [ ] Verify RFID runtime behavior
- [ ] Verify response payload consistency
- [ ] Decide whether to keep or retire `/api/internal/tick`
- [ ] Push changes after approval

## Files Changed Locally

- [x] `lib/timer-engine.ts`
- [x] `lib/card-mode.ts`
- [x] `app/api/esp32/poll/route.ts`
- [x] `app/api/internal/tick/route.ts`
- [x] `app/api/mobile/user/dashboard/route.ts`
- [x] `app/api/admin/status/route.ts`
- [x] `app/api/admin/users/route.ts`
- [x] `app/api/mobile/admin/dashboard/route.ts`
- [x] `app/api/mobile/master/dashboard/route.ts`
- [x] `app/api/master/overview/route.ts`

## Verification Checklist

### Web Mode

- [ ] Start motor from web/dashboard with `availableMinutes = 10`
- [ ] Confirm countdown updates through live route usage
- [ ] Confirm motor stops when remaining reaches `5`
- [ ] Confirm last `5` minutes are preserved correctly

### RFID Mode

- [ ] Start motor with RFID when `availableMinutes = 6`
- [ ] Confirm RFID session starts successfully
- [ ] Confirm countdown follows the same deduction process as web mode
- [ ] Confirm motor stops when remaining reaches `5`
- [ ] Confirm RFID session finalizes cleanly

### Response Consistency

- [ ] Check `motorStatus`
- [ ] Check `remainingMinutes`
- [ ] Check `availableMinutes`
- [ ] Check `cardModeActive`
- [ ] Check `runningUser`
- [ ] Confirm no contradictory payload states after stop

## Risk Checks

- [ ] Web stop-at-5 should not break queue flow
- [ ] RFID finalize should preserve remaining balance correctly
- [ ] Repeated dashboard reads should not over-deduct minutes
- [ ] ESP32 polling should not conflict with unified billing

## Notes

- Local refactor is done, but runtime verification is still pending.
- No push has been done for this billing refactor.
- `npm run typecheck` has already passed locally.
