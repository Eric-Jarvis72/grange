#!/usr/bin/env python3
"""Repack the raw Gemini horse art into the sprites the game loads.

The raw drops are flat-white JPGs: one standing pose per coat facing right, and
a four-frame walk strip per coat. This script knocks out the white background,
splits the walk strips into their four horses, and repacks every frame into a
uniform cell so the cells tile evenly when `frameSourceViews` slices the strip.
Each horse is bottom-aligned and centred in its cell, which keeps the hooves on
a common baseline (no vertical bouncing) and keeps neighbouring frames from
clipping into each other.

Run from the repo root:  python scripts/prepare_horses.py
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "public" / "assets" / "horse"

# Raw background is pure white (channel deviation <= ~4); the lightest horse
# coat only reaches ~24 from white, so this threshold separates the two cleanly.
WHITE_TOL = 13
# Anti-aliased edge pixels are a blend between the coat and the white backdrop.
# Blends lighter than this (measured by deviation from white) are faded out so
# dark coats do not keep a pale fringe, while the solid coat stays opaque.
EDGE_FULL = 70
WALK_FRAMES = 4
# Output widths, kept close to the old art so the sprites stay small files.
# Horses draw 91px wide on screen, so these are a comfortable supersample.
IDLE_WIDTH = 500
WALK_FRAME_WIDTH = 168
# Downscale factor used while labelling, to keep the flood fill fast.
LABEL_SCALE = 4
MIN_COMPONENT = 200

IDLE_RAW = {
    "blackhorse": "Gemini_Generated_Image_vbqz9avbqz9avbqz(1).jpg",
    "pintohorse": "Gemini_Generated_Image_vbqz9avbqz9avbqz.jpg",
    "whitehorse": "Gemini_Generated_Image_vbqz9avbqz9avbqz(2).jpg",
}
WALK_RAW = {
    "blackhorse": "Gemini_Generated_Image_dtzbp9dtzbp9dtzb(4).jpg",
    "pintohorse": "Gemini_Generated_Image_dtzbp9dtzbp9dtzb(3).jpg",
    "whitehorse": "Gemini_Generated_Image_dtzbp9dtzbp9dtzb(5).jpg",
}


def cut_white(path: Path) -> np.ndarray:
    """Load an image and make every flat-white pixel transparent (RGBA)."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    deviation = np.abs(rgb - 255).max(axis=2)
    opaque = deviation > WHITE_TOL
    alpha = np.where(opaque, 255, 0).astype(float)

    # Feather only the opaque pixels that border transparency, fading the pale
    # anti-aliasing blends toward clear so dark coats lose their white fringe.
    border = np.zeros_like(opaque)
    for d_row in (-1, 0, 1):
        for d_col in (-1, 0, 1):
            border |= np.roll(~opaque, (d_row, d_col), axis=(0, 1))
    fade = np.clip((deviation - WHITE_TOL) / (EDGE_FULL - WHITE_TOL), 0.0, 1.0)
    alpha = np.where(opaque & border, np.minimum(alpha, fade * 255.0), alpha)

    return np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])


def crop_to_content(rgba: np.ndarray) -> np.ndarray:
    """Trim transparent margins, leaving only the opaque bounding box."""
    ys, xs = np.where(rgba[:, :, 3] > 0)
    return rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def find_frames(rgba: np.ndarray) -> list[np.ndarray]:
    """Split a walk strip into its four horses, left to right.

    Components are labelled on a downscaled copy for speed, then each horse's
    pixels are isolated at full resolution before cropping. Cropping by the
    bounding box alone is not enough: neighbouring horses' boxes overlap
    horizontally, so a rectangle would scoop up a sliver of the next horse.
    """
    height, width = rgba.shape[:2]
    mask = rgba[:, :, 3] > 0
    small_h = height // LABEL_SCALE
    small_w = width // LABEL_SCALE
    small = np.zeros((small_h, small_w), dtype=bool)
    for row in range(small_h):
        for col in range(small_w):
            block = mask[
                row * LABEL_SCALE : (row + 1) * LABEL_SCALE,
                col * LABEL_SCALE : (col + 1) * LABEL_SCALE,
            ]
            small[row, col] = block.any()

    labels = np.zeros((small_h, small_w), dtype=int)
    components: list[tuple[int, int, int]] = []
    current = 0
    for start_row in range(small_h):
        for start_col in range(small_w):
            if not small[start_row, start_col] or labels[start_row, start_col]:
                continue
            current += 1
            queue = deque([(start_row, start_col)])
            labels[start_row, start_col] = current
            area = 0
            min_col = start_col
            while queue:
                row, col = queue.popleft()
                area += 1
                min_col = min(min_col, col)
                for d_row in (-1, 0, 1):
                    for d_col in (-1, 0, 1):
                        n_row, n_col = row + d_row, col + d_col
                        if (
                            0 <= n_row < small_h
                            and 0 <= n_col < small_w
                            and small[n_row, n_col]
                            and not labels[n_row, n_col]
                        ):
                            labels[n_row, n_col] = current
                            queue.append((n_row, n_col))
            components.append((area, current, min_col))

    kept = [component for component in components if component[0] > MIN_COMPONENT]
    kept.sort(key=lambda component: component[0], reverse=True)
    kept = kept[:WALK_FRAMES]
    kept.sort(key=lambda component: component[2])

    # Expand the coarse labels back to full resolution so each horse's pixels
    # can be isolated exactly.
    full = np.kron(labels, np.ones((LABEL_SCALE, LABEL_SCALE), dtype=int))
    full = full[:height, :width]
    if full.shape != (height, width):
        full = np.pad(
            full,
            ((0, height - full.shape[0]), (0, width - full.shape[1])),
        )

    frames: list[np.ndarray] = []
    for _area, label, _min_col in kept:
        own = (full == label) & mask
        isolated = np.zeros_like(rgba)
        isolated[:, :, :3] = rgba[:, :, :3]
        isolated[:, :, 3] = np.where(own, rgba[:, :, 3], 0)
        frames.append(crop_to_content(isolated))
    return frames


def fit_width(image: Image.Image, width: int) -> Image.Image:
    """Downscale to the target width, preserving aspect ratio."""
    if image.width <= width:
        return image
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)


def build_walk(path: Path) -> Image.Image:
    """Repack a walk strip into four uniform, bottom-aligned cells."""
    rgba = cut_white(path)
    frames = find_frames(rgba)
    cell_w = max(frame.shape[1] for frame in frames)
    cell_h = max(frame.shape[0] for frame in frames)
    strip = Image.new("RGBA", (cell_w * WALK_FRAMES, cell_h), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        framed = Image.fromarray(frame, "RGBA")
        offset_x = index * cell_w + (cell_w - frame.shape[1]) // 2
        offset_y = cell_h - frame.shape[0]
        strip.paste(framed, (offset_x, offset_y), framed)
    return fit_width(strip, WALK_FRAME_WIDTH * WALK_FRAMES)


def build_idle(path: Path) -> Image.Image:
    """Knock out the background and trim the single standing pose."""
    trimmed = Image.fromarray(crop_to_content(cut_white(path)), "RGBA")
    return fit_width(trimmed, IDLE_WIDTH)


def mirror_frames(strip: Image.Image) -> Image.Image:
    """Mirror a walk strip horizontally and reverse the frame order."""
    width, height = strip.size
    frame_w = width // WALK_FRAMES
    frames = [
        ImageOps.mirror(strip.crop((i * frame_w, 0, (i + 1) * frame_w, height)))
        for i in range(WALK_FRAMES)
    ]
    out = Image.new("RGBA", strip.size, (0, 0, 0, 0))
    for index, frame in enumerate(reversed(frames)):
        out.paste(frame, (index * frame_w, 0), frame)
    return out


def main() -> None:
    for color, name in IDLE_RAW.items():
        idle = build_idle(ASSETS / name)
        idle.save(ASSETS / f"{color}_facingright.png")
        ImageOps.mirror(idle).save(ASSETS / f"{color}_facingleft.png")
        print(f"{color}_facingright.png {idle.size}")

    for color, name in WALK_RAW.items():
        walk = build_walk(ASSETS / name)
        walk.save(ASSETS / f"{color}_walk.png")
        mirror_frames(walk).save(ASSETS / f"{color}_leftanimations.png")
        print(f"{color}_walk.png {walk.size}")


if __name__ == "__main__":
    main()
