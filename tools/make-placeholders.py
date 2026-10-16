"""
Creates neutral placeholder images with exactly the same file names and pixel sizes as the
demo photographs in assets/images/. They contain no people, no photographs and nothing that
needs a licence: just soft colour, a thin frame, a small pictogram and the words "Your photo".

Author tool (not shipped to customers). Needs Python 3 and Pillow:  pip install pillow

    python tools/make-placeholders.py

Output: tools/placeholder-images/   (tools/make-zip.ps1 copies these over assets/images in the
customer ZIP unless you pass -IncludeDemoPhotos).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images')
OUT = os.path.join(ROOT, 'tools', 'placeholder-images')

# Palette taken from the template (ivory, sage, rose, forest, gold)
TINTS = {
    'hero':     ((226, 231, 220), (205, 214, 197)),   # sage
    'story':    ((240, 226, 222), (226, 205, 199)),   # rose
    'portrait': ((226, 231, 220), (205, 214, 197)),
    'gallery':  ((240, 226, 222), (226, 205, 199)),
    'final':    ((96, 118, 104), (70, 92, 79)),       # dark: ivory text sits on it
    'og':       ((248, 245, 239), (232, 226, 214)),
}
INK_DARK = (52, 72, 59)
INK_LIGHT = (248, 245, 239)
GOLD = (180, 154, 105)

FONT_CANDIDATES = [
    'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf',
]


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def kind_of(name):
    for k in ('hero', 'story', 'portrait', 'gallery', 'final', 'og'):
        if name.startswith(k):
            return k
    return 'gallery'


def label_for(name):
    base = os.path.splitext(name)[0]
    k = kind_of(name)
    return {'hero': 'Hero photo', 'story': 'Our story photo', 'portrait': 'Portrait', 'gallery': 'Gallery photo',
            'final': 'Closing photo', 'og': 'Social sharing image'}[k]


def make(name, w, h):
    k = kind_of(name)
    top, bottom = TINTS[k]
    ink = INK_LIGHT if k == 'final' else INK_DARK
    img = Image.new('RGB', (w, h), top)
    px = ImageDraw.Draw(img)
    for y in range(h):                                   # soft vertical gradient
        t = y / max(1, h - 1)
        px.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))

    s = min(w, h)
    d = ImageDraw.Draw(img)
    m = int(s * 0.045)
    d.rectangle([m, m, w - m, h - m], outline=GOLD, width=max(1, s // 300))   # thin gold frame

    # pictogram: a framed landscape with sun and two hills, centred a little above the middle
    pw = int(s * 0.26); ph = int(pw * 0.72)
    cx, cy = w // 2, int(h * 0.42)
    x0, y0, x1, y1 = cx - pw // 2, cy - ph // 2, cx + pw // 2, cy + ph // 2
    lw = max(2, s // 160)
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(pw * 0.07), outline=ink, width=lw)
    d.ellipse([x0 + pw * 0.64, y0 + ph * 0.16, x0 + pw * 0.84, y0 + ph * 0.16 + pw * 0.2], outline=ink, width=lw)
    d.line([(x0 + pw * 0.08, y1 - ph * 0.12), (x0 + pw * 0.38, y0 + ph * 0.52), (x0 + pw * 0.58, y0 + ph * 0.74),
            (x0 + pw * 0.74, y0 + ph * 0.58), (x1 - pw * 0.06, y1 - ph * 0.12)], fill=ink, width=lw, joint='curve')

    big = font(max(14, int(s * 0.055)))
    small = font(max(11, int(s * 0.034)))
    title = 'YOUR PHOTO HERE'
    sub = f'{label_for(name)}  \u00b7  {w} \u00d7 {h} px'
    file_line = name
    ty = y1 + int(s * 0.07)
    for text, f, color in ((title, big, ink), (sub, small, ink), (file_line, small, GOLD if k != 'final' else INK_LIGHT)):
        bbox = d.textbbox((0, 0), text, font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((w - tw) / 2 - bbox[0], ty - bbox[1]), text, font=f, fill=color)
        ty += int(th + s * 0.03)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    count = 0
    for name in sorted(os.listdir(SRC)):
        ext = os.path.splitext(name)[1].lower()
        if ext not in ('.webp', '.jpg', '.jpeg', '.png'):
            continue
        with Image.open(os.path.join(SRC, name)) as src:
            w, h = src.size
        img = make(name, w, h)
        target = os.path.join(OUT, name)
        if ext == '.webp':
            img.save(target, 'WEBP', quality=80, method=6)
        elif ext in ('.jpg', '.jpeg'):
            img.save(target, 'JPEG', quality=86, optimize=True, progressive=True)
        else:
            img.save(target, optimize=True)
        count += 1
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'Wrote {count} placeholders to {OUT} ({total / 1024:.0f} KB)')


if __name__ == '__main__':
    sys.exit(main())
