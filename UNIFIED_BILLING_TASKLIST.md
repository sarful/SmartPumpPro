# Unified Billing Tasklist

## Goal

Make `web` and `RFID` motor usage follow the same practical minute-deduction outcome:

- countdown by elapsed runtime
- stop when the threshold is reached
- preserve the last `5` minutes
- avoid requiring a separate RFID-only billing engine

## Completed

- Added unified billing logic in [lib/timer-engine.ts](c:/Users/Lab/Desktop/smartpump/smartpump-pro/lib/timer-engine.ts)
- Wired live billing updates through [app/api/esp32/poll/route.ts](c:/Users/Lab/Desktop/smartpump/smartpump-pro/app/api/esp32/poll/route.ts)
- Reduced RFID-specific billing duplication in [lib/card-mode.ts](c:/Users/Lab/Desktop/smartpump/smartpump-pro/lib/card-mode.ts)
- Added request-driven unified billing calls to dashboard/mobile read routes
- Typecheck passed locally

## Runtime Verification

### RFID

- Verified on live device polling
- Session starts correctly with:
  - `cardModeActive = true`
  - `motorStatus = RUNNING`
  - `remainingMinutes = 6`
  - `availableMinutes = 6`
- Session stops correctly with:
  - `motorStatus = OFF`
  - `availableMinutes = 5`
  - `cardModeActive = false`

Status: `PASSED`

### Web

- Verified on live device polling
- Session starts correctly with:
  - `motorStatus = RUNNING`
  - `remainingMinutes = 6`
  - `availableMinutes = 0`
- Session stops correctly with:
  - `motorStatus = OFF`
  - `availableMinutes = 5`

Status: `PASSED`

### HOLD / Resume

- Verified on live behavior
- Web mode now goes to `HOLD` when device/internet becomes unavailable
- RFID mode now also goes to `HOLD` when device/internet becomes unavailable
- Both modes resume to `RUNNING` when:
  - device becomes ready again
  - internet/polling becomes available again
  - load shedding is no longer active

Status: `PASSED`

## Regression Note

- Commit `f0c9d7c` introduced a bad alignment patch that caused incorrect refund behavior
- That regression was reverted by commit `55769af`
- Current stable behavior is based on the unified billing refactor from commit `ffa52c4` plus the revert of `f0c9d7c`

## Current Stable Conclusion

- Web: working
- RFID: working
- Stop-at-5 outcome: working
- Final preserved balance at stop: working

## Known Nuance

- Web and RFID now produce the same practical stop result
- Their internal start path is still not perfectly identical at the code-path level
- But the verified live runtime outcome is correct for both modes

## Push Status

- Unified billing refactor pushed
- Regression patch pushed and reverted
- Current live baseline confirmed stable
- Cron compatibility retired; billing now depends on live request-driven paths only
