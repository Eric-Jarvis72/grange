# Marketplace sprite assets

These transparent WebP files were cropped from `Cozy farm marketplace sprite sheet.png` without redesigning the supplied artwork.

## Buildings

- `seed-shop.webp`
- `produce-stall.webp`
- `game-hall.webp`

## Objects

- `seed-display.webp`
- `produce-cart.webp`
- `notice-board.webp`
- `card-table.webp`
- `slot-machine.webp`
- `signpost.webp`

The shared farm/marketplace train is stored at `public/assets/transport/starter-train.webp` and was cropped from `Rusty starter train and wagon.png`.

While the train is moving it cycles through three wheel poses: `starter-train.webp`
(also the parked pose), `train-animation-1.webp`, and `train-animation-2.webp`. The
two animation frames were supplied as JPEGs and had their background keyed out to
transparency with GraphicsMagick
(`-fuzz 12% -fill none -draw "matte 0,0 floodfill"`) and saved as lossless WebP.
