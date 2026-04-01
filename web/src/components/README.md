# Components — Reference

Shared UI components exported from `src/components/index.ts`.

## `TacticsPanel`

Displays the tactical recommendation for a selected zone: rig, depth, retrieve style, cadence, and the reasons why the zone is productive.

Props:

| Prop | Type | Description |
|---|---|---|
| `tactics` | `Tactic[]` | Full tactics array from the analysis result |
| `zones` | `Zone[]` | Full zones array from the analysis result |
| `selectedZoneId` | `string \| null` | The currently selected zone; renders nothing when `null` |

## `TextOnlyResults`

Fallback results view for when the overlay canvas is unavailable. Renders `plan_summary` and `conditions_summary` text from the analysis result.

Props:

| Prop | Type | Description |
|---|---|---|
| `result` | `CastSenseAnalysisResult` | The full analysis result |
| `unavailableReason?` | `string` | Optional explanation shown above the text summary |

## `overlays/OverlayCanvas`

Canvas overlay rendered on top of the captured image. Draws zone polygons, cast arrows, and retrieve paths. Handles zone tap/click selection via polygon hit-testing.

Props:

| Prop | Type | Description |
|---|---|---|
| `zones` | `Zone[]` | Zones to render |
| `imageSize` | `Size` | Original image dimensions in pixels |
| `displaySize` | `Size` | Display container dimensions in pixels |
| `fitMode` | `'contain' \| 'cover'` | Image fit mode for coordinate mapping |
| `selectedZoneId` | `string \| null` | Highlighted zone |
| `onZoneSelect` | `(zoneId: string \| null) => void` | Called on zone tap/click |
| `showCastArrows?` | `boolean` | Default: `true` |
| `showRetrievePaths?` | `boolean` | Default: `true` |

Zone polygon fill colours by hint type:

| Hint | Colour |
|---|---|
| `cover` | Green `#2f7d4f` |
| `structure` | Blue `#2066c4` |
| `current` | Orange `#ce7028` |
| `depth_edge` | Purple `#7046b8` |
| `shade` | Grey-blue `#5f7183` |
| `inflow` | Teal `#0d8b9e` |
| `unknown` | Grey `#8b8e98` |
