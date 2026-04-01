# Types — Reference

Domain types for CastSense are maintained in `src/types/contracts.ts`. There is no external code generation step.

## Enumerations

### `AnalysisMode`

```ts
'general' | 'specific'
```

- `general` — identify likely species and suggest tactics for the scene
- `specific` — user has named a target species; analysis focuses on that species

### `PlatformContext`

```ts
'shore' | 'kayak' | 'boat'
```

The angler's platform. Affects tactic viability (e.g. certain casts are impractical from a kayak).

### `GearType`

```ts
'spinning' | 'baitcasting' | 'fly' | 'unknown'
```

### `CaptureType`

```ts
'photo' | 'video'
```

Currently only `photo` is used in the analysis pipeline.

## Coordinates

### `NormalizedPoint`

```ts
[number, number]  // [x, y] in range [0..1]
```

All coordinate values returned by the AI are normalized to `[0..1]` relative to the captured image dimensions. Use the utilities in `src/utils/coordinate-mapping.ts` to convert to screen pixels.

### `CastArrow`

```ts
{ start: NormalizedPoint; end: NormalizedPoint }
```

## Analysis types

### `Zone`

A detected fishable zone in the scene.

| Field | Type | Description |
|---|---|---|
| `zone_id` | `string` | Unique identifier within this result |
| `label` | `string` | Human-readable name (e.g. `"Submerged Structure"`) |
| `confidence` | `number` | Model confidence, `0..1` |
| `target_species` | `string` | Primary species this zone is recommended for |
| `polygon` | `NormalizedPoint[]` | Zone boundary (minimum 3 points) |
| `cast_arrow` | `CastArrow` | Suggested cast start and end positions |
| `retrieve_path?` | `NormalizedPoint[]` | Suggested lure retrieve path |
| `style?` | `ZoneStyle` | Visual hint and display priority |

### `ZoneStyle`

| Field | Type | Values |
|---|---|---|
| `priority?` | `number` | Higher values rendered first |
| `hint?` | `string` | `cover` \| `structure` \| `current` \| `depth_edge` \| `shade` \| `inflow` \| `unknown` |

### `Tactic`

Tactical instructions associated with a zone, keyed by `zone_id`.

| Field | Type | Description |
|---|---|---|
| `zone_id` | `string` | Matches a `Zone.zone_id` |
| `recommended_rig` | `string` | Primary rig recommendation |
| `alternate_rigs?` | `string[]` | Alternative rig options |
| `target_depth` | `string` | Depth range to target |
| `retrieve_style` | `string` | Retrieve technique |
| `cadence?` | `string` | Retrieve cadence description |
| `why_this_zone_works` | `string[]` | Reasons this zone is productive |
| `steps?` | `string[]` | Step-by-step fishing instructions |

### `CastSenseAnalysisResult`

The full response from the AI analysis pipeline.

Key fields: `mode`, `zones`, `tactics`, `conditions_summary`, `plan_summary`, `likely_species`, `explainability`, `analysis_frame`.

## Request metadata

### `CastSenseRequestMetadata`

Metadata sent alongside the image in the analysis request. Includes:

- `client` — platform, app version, device model, locale, timezone
- `request` — mode, target species, platform context, gear type, capture type and timestamp
- `location?` — GPS coordinates, accuracy, altitude, heading, speed
- `user_constraints?` — available lures, line test weight (lb), free-text notes
