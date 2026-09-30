# Prepared farm sprites

This directory contains browser-ready WebP assets prepared from the four user-provided 1254 × 1254
source sheets. The original PNG files are intentionally not copied into the repository because each
is larger than the repository's 1 MiB limit.

## Layout

- `terrain.webp`: a 256 × 256 sheet with sixteen 64 × 64 tiles in a 4 × 4 grid.
- `terrain/`: the same sixteen tiles as individual files.
- `plants/`: sixteen tightly cropped transparent sprites.
- `buildings/`: four tightly cropped transparent sprites.
- `objects/`: sixteen tightly cropped transparent sprites.
- `manifest.json`: filenames, pixel dimensions, normalized anchors, and terrain frame positions.

All files are below 1 MiB. Transparent sprites use a bottom-center anchor (`0.5, 1`); terrain tiles
use a top-left anchor (`0, 0`). Low-opacity edge colors were cleaned before encoding to remove the
red/orange fringe visible in the source sheets.

## Phaser loading examples

Load the terrain sheet by fixed-size frame:

```ts
this.load.spritesheet('farm-terrain', '/assets/farm/terrain.webp', {
  frameWidth: 64,
  frameHeight: 64,
});
```

Load a standalone sprite:

```ts
this.load.image('farmhouse', '/assets/farm/buildings/farmhouse.webp');
```

The terrain entries in `manifest.json` include zero-based `column` and `row` positions. With four
columns, a tile's Phaser frame index is `row * 4 + column`.

## Regeneration

The preparation script requires Python 3 with OpenCV and Google's `cwebp` command. Run it from the
repository root with an empty output directory:

```sh
python3 .tools/prepare_farm_assets.py \
  --terrain "/path/to/terrain.png" \
  --plants "/path/to/plants.png" \
  --buildings "/path/to/buildings.png" \
  --objects "/path/to/objects.png" \
  --output "/path/to/empty-output-directory"
```

The script detects the transparent sprites as connected components, orders them in reading order,
crops them with a small transparent margin, cleans low-alpha edge contamination, and writes WebP at
quality 92 with maximum alpha quality. Confirm the source artwork's usage rights before publishing.
