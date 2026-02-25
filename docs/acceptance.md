# CastSense Acceptance Checklist (Mobile-Only Architecture)

This checklist defines acceptance criteria for the mobile-only version of CastSense.

## Client Acceptance

| # | Criteria | Status | Verification |
|---|----------|--------|--------------|
| C1 | Settings screen with API key management | 🔶 Manual | [M1: Settings & API key](#m1-settings--api-key-verification) |
| C2 | API key validation (format + connectivity) | 🔶 Manual | [M1: Settings & API key](#m1-settings--api-key-verification) |
| C3 | Photo capture (orientation handling) | 🔶 Manual | [M2: Camera capture](#m2-camera-capture-verification) |
| C4 | Image processing (resize, optimize, orientation) | ✅ Automated | Image processor tests |
| C5 | Context enrichment (weather, geocoding, solar) | ✅ Automated | Enrichment orchestration tests |
| C6 | OpenAI API integration (two-stage prompting) | ✅ Automated | AI client tests |
| C7 | Local schema validation | ✅ Automated | [Mobile unit tests](../mobile/src/__tests__/) - validation.test.ts |
| C8 | Overlay rendering correct across aspect ratios | ✅ Automated | [coordinate-mapping.test.ts](../mobile/src/__tests__/coordinate-mapping.test.ts#L46-L150) - tests portrait/landscape/cover modes |
| C9 | Tap zone selects correct tactics | ✅ Automated | [polygon-hit-test.test.ts](../mobile/src/__tests__/polygon-hit-test.test.ts#L115-L210) - `findZoneAtPoint` and priority tests |
| C10 | Error UX for all error states | 🔶 Manual | [M3: Error UX verification](#m3-error-ux-verification) + [Error components](../mobile/src/components/errors/index.ts) |
| C11 | Handles `text_only` responses | 🔶 Partial | [TextOnlyResults.tsx](../mobile/src/components/TextOnlyResults.tsx) + [M4: Text-only fallback](#m4-text-only-fallback-verification) |
| C12 | State machine transitions | ✅ Automated | State machine tests |
| C13 | Analysis completes < 15s (P95) | 🔶 Manual | [M5: Performance verification](#m5-performance-verification) |

## Automated Test Summary

| Test Suite | Command | Coverage |
|------------|---------|----------|
| Mobile Unit Tests | `cd mobile && npm test` | coordinate mapping, polygon hit tests, validation, state machine |
| Mobile Type Checking | `cd mobile && npm run typecheck` | TypeScript compilation |
| Mobile Linting | `cd mobile && npm run lint` | ESLint rules |

**Note:** Backend tests removed - no backend in mobile-only architecture.

---

## Manual QA Steps

### M1: Settings & API Key Verification

**Prerequisites:** iOS/Android device

1. **Navigate to Settings**
   - Open the CastSense app
   - Tap Settings button (top-right corner of home screen)
   - Verify Settings screen opens

2. **API Key Input**
   - Enter an invalid key (e.g., "test123")
   - Verify validation shows error (✗ invalid)
   - Enter a valid OpenAI API key (starts with `sk-`)
   - Verify validation shows success (✓ valid)

3. **Secure Storage**
   - Close app completely
   - Reopen app
   - Navigate to Settings
   - Verify API key is still present (persisted)
   - Verify key is masked/hidden for security

4. **Help Links**
   - Verify "Get API Key" link works
   - Verify opens OpenAI documentation

**Pass criteria:** ✅ API key validation works, secure storage persists key, help links functional

---

### M2: Camera Capture Verification

**Prerequisites:** iOS/Android device with camera permissions

1. **Navigate to Capture**
   - Open the CastSense app
   - Select mode (General or Specific)
   - Tap "Open Camera" button
   - Verify camera preview shows

2. **Photo Capture**
   - Tap capture button once
   - Verify preview shows captured image
   - Verify no crash or hang
   - Verify processing screen appears

3. **Orientation Handling**
   - Rotate device to landscape
   - Capture photo
   - Verify orientation is correct in preview
   - Return to portrait, capture again
   - Verify orientation handling works in all modes

**Pass criteria:** ✅ Photo captures instantly, orientation handled correctly, no crashes

---

### M3: Error UX Verification

**Prerequisites:** Device with controllable network/GPS

1. **No API Key Error:**
   - Clear API key from Settings (or fresh install)
   - Attempt to capture and analyze
   - Verify redirected to Settings with message
   - Enter API key, retry, verify success

2. **GPS Error:**
   - Disable location services
   - Attempt to capture and analyze
   - Verify LocationErrorView displays with "Enable GPS" action
   - Enable GPS, retry, verify success

3. **Network Error:**
   - Enable airplane mode (with WiFi off)
   - Attempt to analyze a captured photo
   - Verify NetworkErrorView displays with "Retry" action
   - Disable airplane mode, tap retry, verify success

4. **AI Timeout (simulated):**
   - If possible, trigger timeout scenario
   - Verify appropriate error message
   - Verify auto-retry occurs once
   - Verify fallback behavior after failed retry

**Pass criteria:** ✅ All error states show correct UI with actionable buttons

---

### M4: Text-Only Fallback Verification

**Prerequisites:** Ability to force invalid AI output (test mode or mocked)

1. Trigger a `text_only` response (e.g., by forcing AI validation failure)
2. Verify ResultsScreen shows TextOnlyResults component
3. Verify tactics are displayed without overlay polygons
4. Verify plan_summary and conditions_summary are readable
5. Verify no crash when zones array is empty
6. Verify user can still read fishing advice

**Pass criteria:** ✅ Text-only results display cleanly without visual artifacts

---

### M5: Performance Verification

**Prerequisites:** Real device (not simulator), stable network

1. **Capture Photo**
   - Time from capture button press to results display
   - Repeat 5 times
   - Verify P50 < 10s, P95 < 15s

2. **Check Breakdown** (if debug mode available)
   - Image processing: < 1s
   - Enrichment: < 3s total
   - AI analysis: < 8s (typical)
   - Total: < 15s (P95)

3. **Network Conditions**
   - Test on WiFi (fast)
   - Test on cellular (typical)
   - Test on slow connection
   - Verify reasonable performance in all cases

**Pass criteria:** ✅ Analysis completes within target latency across network conditions

---

### M6: Privacy Verification

**Prerequisites:** Network monitoring tool (optional but recommended)

1. **Data Flow Audit**
   - Monitor network traffic during analysis
   - Verify requests only go to:
     - OpenAI API (api.openai.com)
     - Weather API (open-meteo.com or similar)
     - Geocoding API (nominatim.org or similar)
     - Optional: USGS (waterdata.usgs.gov)
   - Verify NO requests to CastSense servers

2. **API Key Security**
   - Verify API key not logged in console
   - Verify API key encrypted in device storage
   - Verify API key not visible in app UI (masked)

3. **Media Cleanup**
   - After analysis completes
   - Verify temporary image removed from device
   - Verify no cached copies persisted

**Pass criteria:** ✅ No data sent to CastSense servers, API key secure, media cleaned up

---

## CI/CD Integration

Automated acceptance checks run via:

- **Local:** `npm test` from mobile directory
- **CI:** `.github/workflows/ci.yml` (mobile-only workflow)

### Quick Acceptance Check

```bash
# Run mobile tests
cd mobile && npm test

# Type checking
cd mobile && npm run typecheck

# Linting
cd mobile && npm run lint
```

---

## Coverage Matrix

| Area | Automated | Manual | Total Items |
|------|-----------|--------|-------------|
| Client | 7 | 6 | 13 |
| **Total** | **7** | **6** | **13** |

**Automated coverage:** 54% (7/13 items)

**Note:** Backend acceptance removed - mobile-only architecture eliminates backend infrastructure.

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-17 | 1.0 | Initial acceptance checklist |
| 2026-02-25 | 2.0 | Updated for mobile-only architecture (removed backend) |
