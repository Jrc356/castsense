# Utilities — Reference

Geometry utilities for mapping AI result coordinates to screen positions and for zone tap/click selection.

## `coordinate-mapping`

Maps normalized `[0..1]` coordinates (as returned by the AI) to pixel positions on screen, accounting for aspect ratio differences between the captured image and the display container.

### `createCoordinateMapper(imageSize, displaySize, fitMode)`

Returns a `CoordinateMapper` for the given image and display sizes.

| Parameter | Type | Description |
|---|---|---|
| `imageSize` | `Size` | Original image dimensions in pixels |
| `displaySize` | `Size` | Display container dimensions in pixels |
| `fitMode` | `'contain' \| 'cover'` | `contain`: letterbox/pillarbox; `cover`: crop to fill |

`CoordinateMapper` interface:

| Member | Description |
|---|---|
| `normalizedToScreen(point)` | Convert `[0..1]` coord to `{x, y}` pixel position |
| `screenToNormalized(point)` | Convert pixel position to `[0..1]` coord |
| `getLetterboxOffsets()` | Returns `{x, y}` padding offsets; both zero in cover mode |
| `getScaleFactor()` | The scale multiplier used for mapping |
| `imageSize` | Original image size passed at construction |
| `displaySize` | Display size passed at construction |
| `fitMode` | Fit mode passed at construction |

### `transformPolygonToScreen(polygon, mapper)`

Converts an array of normalized `NormalizedPoint` values to screen-space `Point[]`.

### `transformPathToScreen(path, mapper)`

Converts a retrieve path (array of normalized points) to screen-space `Point[]`.

### `getPolygonCenter(polygon)`

Returns the centroid `Point` of a screen-space polygon. Used for zone label placement.

## `polygon-hit-test`

Point-in-polygon tests for zone selection on tap/click.

### `isPointInPolygon(point, polygon)`

Returns `true` if `point` is inside `polygon`. Uses the ray casting algorithm.

| Parameter | Type | Description |
|---|---|---|
| `point` | `Point` | The point to test |
| `polygon` | `Point[]` | Polygon vertices in screen space (minimum 3 points) |

### `findZoneAtPoint(screenPoint, zones, mapper)`

Finds the first zone whose polygon contains `screenPoint`. Returns the matching `Zone` or `null`.

| Parameter | Type | Description |
|---|---|---|
| `screenPoint` | `Point` | Click/tap position in screen pixels |
| `zones` | `Zone[]` | All zones from the analysis result |
| `mapper` | `CoordinateMapper` | Mapper constructed for the current image/display sizes |
