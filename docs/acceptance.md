# CastSense Acceptance Checklist

Per §16 of the Technical Specification.

## Client Acceptance

| # | Criteria | Status | Verification |
|---|----------|--------|--------------|
| C1 | Capture photo and video (5–10s) | 🔶 Manual | [M1: Camera capture](#m1-camera-capture-verification) |
| C2 | Upload request conforms to metadata schema | ✅ Automated | [contracts.test.ts](../backend/src/__tests__/contracts.test.ts#L34-L40) - validates fixtures against metadata.schema.json |
| C3 | Overlay rendering correct across aspect ratios (contain/cover tested) | ✅ Automated | [coordinate-mapping.test.ts](../mobile/src/__tests__/coordinate-mapping.test.ts#L46-L150) - tests portrait/landscape/cover modes |
| C4 | Tap zone selects correct tactics | ✅ Automated | [polygon-hit-test.test.ts](../mobile/src/__tests__/polygon-hit-test.test.ts#L115-L210) - `findZoneAtPoint` and priority tests |
| C5 | Error UX for GPS/network/server errors | 🔶 Manual | [M2: Error UX verification](#m2-error-ux-verification) + [Error components](../mobile/src/components/errors/index.ts) |
| C6 | Handles `text_only` responses | 🔶 Partial | [TextOnlyResults.tsx](../mobile/src/components/TextOnlyResults.tsx) + [M3: Text-only fallback](#m3-text-only-fallback-verification) |

## Backend Acceptance

| # | Criteria | Status | Verification |
|---|----------|--------|--------------|
| B1 | `/v1/analyze` accepts and validates inputs + size limits | ✅ Automated | [contracts.test.ts](../backend/src/__tests__/contracts.test.ts#L89-L180) - tests missing metadata, invalid JSON, MIME types |
| B2 | Enrichment runs in parallel with timeouts; produces canonical context pack | ✅ Automated | [analyze-photo.test.ts](../backend/src/__tests__/e2e/analyze-photo.test.ts) - E2E with enrichment |
| B3 | Video keyframe extraction reliable and bounded in time | ✅ Automated | [analyze-video.test.ts](../backend/src/__tests__/e2e/analyze-video.test.ts) - E2E video processing |
| B4 | AI invocation returns schema-constrained JSON | ✅ Automated | [validation.test.ts](../backend/src/__tests__/validation.test.ts#L57-L100) - schema validation tests |
| B5 | Validation + single repair attempt implemented | ✅ Automated | [validation.test.ts](../backend/src/__tests__/validation.test.ts#L260-L350) - text-only fallback tests |
| B6 | Media deletion policy enforced | 🔶 Manual | [M4: Media cleanup verification](#m4-media-cleanup-verification) |
| B7 | Observability: metrics + structured logs + trace spans | ✅ Implemented | [observability/index.ts](../backend/src/services/observability/index.ts) - exports metrics, logger, tracing |
| B8 | Rate limits + authentication enforced | ✅ Implemented | [rate-limiter.ts](../backend/src/middleware/rate-limiter.ts) + [auth.ts](../backend/src/middleware/auth.ts) |

## Automated Test Summary

| Test Suite | Command | Coverage |
|------------|---------|----------|
| Backend Unit Tests | `cd backend && npm test` | contracts, validation, services |
| Backend E2E Tests | `cd backend && npm test -- --testPathPattern=e2e` | photo/video happy paths |
| Mobile Unit Tests | `cd mobile && npm test` | coordinate mapping, polygon hit tests |
| Type Checking (Backend) | `cd backend && npm run typecheck` | TypeScript compilation |
| Type Checking (Mobile) | `cd mobile && npm run typecheck` | TypeScript compilation |
| Linting (Backend) | `cd backend && npm run lint` | ESLint rules |
| Linting (Mobile) | `cd mobile && npm run lint` | ESLint rules |

---

## Manual QA Steps

### M1: Camera Capture Verification

**Prerequisites:** iOS/Android device with camera permissions

1. Open the CastSense app
2. Navigate to Capture screen
3. **Photo capture:**
   - Tap capture button once
   - Verify preview shows captured image
   - Verify no crash or hang
4. **Video capture:**
   - Long-press capture button for 5 seconds
   - Release and verify video preview
   - Long-press for 10+ seconds
   - Verify recording stops automatically at max duration
5. **Expected:** Both photo and video capture work smoothly

**Pass criteria:** ✅ Photo captures instantly, video records 5-10s without issues

---

### M2: Error UX Verification

**Prerequisites:** Device with controllable network/GPS

1. **GPS Error:**
   - Disable location services
   - Attempt to capture and analyze
   - Verify LocationErrorView displays with "Enable GPS" action
   - Enable GPS, retry, verify success

2. **Network Error:**
   - Enable airplane mode (with WiFi off)
   - Attempt to analyze a captured photo
   - Verify NetworkErrorView displays with "Retry" action
   - Disable airplane mode, tap retry, verify success

3. **Server Error (simulated):**
   - If possible, point app to invalid backend URL
   - Attempt analysis
   - Verify ServerErrorView displays appropriately

**Pass criteria:** ✅ All error states show correct UI with actionable buttons

---

### M3: Text-Only Fallback Verification

**Prerequisites:** Backend returning `text_only` rendering mode

1. Trigger a `text_only` response (e.g., by forcing AI validation failure)
2. Verify ResultsScreen shows TextOnlyResults component
3. Verify tactics are displayed without overlay polygons
4. Verify plan_summary and conditions_summary are readable
5. Verify no crash when zones array is empty

**Pass criteria:** ✅ Text-only results display cleanly without visual artifacts

---

### M4: Media Cleanup Verification

**Prerequisites:** Access to backend server/logs

1. Submit an analysis request with a photo
2. Wait for response
3. Check server storage/temp directory
4. Verify uploaded media file has been deleted after processing
5. Check logs for media cleanup confirmation

**Pass criteria:** ✅ No media files persist after request completion

---

## CI/CD Integration

Automated acceptance checks run via:

- **Local:** `./scripts/acceptance-check.sh`
- **CI:** `.github/workflows/ci.yml`

### Quick Acceptance Check

```bash
# Run all automated checks
./scripts/acceptance-check.sh

# Run specific test suite
cd backend && npm test
cd mobile && npm test
```

---

## Coverage Matrix

| Area | Automated | Manual | Total Items |
|------|-----------|--------|-------------|
| Client | 3 | 3 | 6 |
| Backend | 7 | 1 | 8 |
| **Total** | **10** | **4** | **14** |

**Automated coverage:** 71% (10/14 items)

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-17 | 1.0 | Initial acceptance checklist per T13.1 |
