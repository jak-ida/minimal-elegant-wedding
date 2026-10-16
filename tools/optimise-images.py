"""
Optional helper: converts original photographs into responsive WebP sizes.

Usage (requires Python 3 + Pillow, only needed if you want to regenerate images):
    python tools/optimise-images.py path/to/originals

For every image "name.jpg|png|webp" it writes assets/images/name-480.webp and
assets/images/name-<native width, max 1600>.webp. Then reference the files in js/config.js.
This script is a convenience for the author; the website itself needs no build step.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
SMALL = 480
MAX = 1600
QUALITY = 80


def convert(src: Path) -> None:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    large_w = min(w, MAX)
    for target in sorted({SMALL, large_w}):
        if target > w:
            continue
        th = round(h * target / w)
        resized = img.resize((target, th), Image.LANCZOS)
        dest = OUT / f"{src.stem}-{target}.webp"
        resized.save(dest, "WEBP", quality=QUALITY, method=6)
        print(f"{dest.name}: {target}x{th}, {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(Path(sys.argv[1]).iterdir()):
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            convert(path)
