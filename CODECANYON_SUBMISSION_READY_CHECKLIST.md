# CodeCanyon Submission Ready Checklist

## Goal

Prepare PumpPilot web, mobile, firmware samples, and buyer documentation so the product is fully ready for CodeCanyon submission.

## Buyer Documentation

- [ ] Finalize web Beginner Guide wording
- [ ] Finalize web Documentation page wording
- [ ] Finalize mobile README
- [ ] Finalize buyer quick-start guides
- [ ] Keep wording buyer-friendly and consistent across web and mobile

## Secrets and Buyer-Safe Examples

- [ ] Replace all buyer-visible firmware `DEVICE_KEY` values with placeholders
- [ ] Keep `ADMIN_ID` placeholders clear in firmware examples
- [ ] Confirm no private or production secrets exist in buyer-facing code or docs

## Firmware Sample Review

- [ ] Review ESP32 Arduino sample
- [ ] Review ESP32 MicroPython sample
- [ ] Review ESP8266 sample
- [ ] Review TTGO T-Call sample
- [ ] Review STM32 + SIM800L sample
- [ ] Add note where `setInsecure()` is demo/default only
- [ ] Make firmware setup instructions consistent across samples

## Web Final Verification

- [ ] User login works
- [ ] Admin login works
- [ ] Master login works
- [ ] User start/stop flow works
- [ ] Queue flow works
- [ ] RFID flow works
- [ ] HOLD / resume works
- [ ] Admin recharge and request approval flow works

## Mobile Final Verification

- [ ] Mobile login works
- [ ] Mobile user dashboard works
- [ ] Mobile admin dashboard works
- [ ] Mobile start/stop works
- [ ] Mobile HOLD messaging is clear
- [ ] Mobile RFID-related dashboard behavior is correct

## Clean Install Verification

- [ ] Install from a clean copy of the package
- [ ] Follow docs exactly without hidden steps
- [ ] Configure env values from docs
- [ ] Run setup commands successfully
- [ ] Confirm app starts successfully after clean setup

## Package Quality

- [ ] No `.env.local` or private env files included
- [ ] No test/demo secrets included
- [ ] No unnecessary dev junk in buyer package
- [ ] Install docs included
- [ ] Quick-start docs included
- [ ] Firmware examples included

## Technical Quality Gates

- [ ] `smartpump-pro` typecheck passes
- [ ] `smartpump-mobile` typecheck passes
- [ ] Release validation scripts pass
- [ ] No stale imports or broken references remain

## Branding and Consistency

- [ ] PumpPilot naming is consistent across web, mobile, docs, and package output
- [ ] No outdated SmartPump references remain
- [ ] Buyer-facing terminology is consistent

## Marketplace Readiness

- [ ] Documentation clearly explains requirements, installation, configuration, and usage
- [ ] Product limitations and dependencies are clearly described
- [ ] Demo/screenshots/presentation wording is consistent with the product
- [ ] Final buyer package structure is clean and review-ready

## Envato Submission Check

- [ ] Confirm Envato/CodeCanyon submission intake is open
- [ ] Confirm author account is eligible to submit
- [ ] Submit only after all checklist items above are complete

