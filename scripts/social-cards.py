"""Compose checked-in social PNGs using the approved logo and repository fonts.

Authoring only: requires Pillow and fontTools[woff]. Site build uses Node alone.
"""
import io
import json
from pathlib import Path
import sys

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"


def font(name, size):
    source = TTFont(ASSETS / "fonts" / name)
    source.flavor = None
    binary = io.BytesIO()
    source.save(binary)
    binary.seek(0)
    face = ImageFont.truetype(binary, size)
    # Repository Bitter files are variable fonts with a default weight of 100;
    # the filename alone does not select the brand's intended weight.
    if name.startswith("bitter-"):
        face.set_variation_by_axes([600])
    return face


def wrap(draw, text, face, width):
    lines = []
    for word in text.split():
        if draw.textlength(word, font=face) > width:
            raise ValueError(f"Word too long for social card: {word}")
        if lines and draw.textlength(lines[-1] + " " + word, font=face) <= width:
            lines[-1] += " " + word
        else:
            lines.append(word)
    return lines


def render(card, width, height):
    # Fixed export palette follows the site's dark theme. Social images are
    # independent of the visitor's light/dark preference.
    image = Image.new("RGB", (width, height), "#191c1e")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 11), fill="#6fb9c2")
    draw.rounded_rectangle((836, 144, 1140, 468), radius=30, fill="#212527")
    logo = Image.open(ASSETS / "logo.png").convert("RGBA")
    if logo.size != (256, 256):
        raise ValueError("Expected the approved 256×256 logo")
    image.paste(logo, (860, 178), logo)
    draw.text((64, 51), card["brand"], font=font("bitter-600-latin.woff2", 64), fill="#e9ebea")
    small = font("pt-sans-400-latin.woff2", 27)
    draw.text((67, 133), card["product"].upper(), font=small, fill="#6fb9c2")
    for size in range(62, 43, -2):
        title_font = font("pt-sans-700-latin.woff2", size)
        lines = wrap(draw, card["title"], title_font, 716)
        if len(lines) <= 3:
            break
    else:
        raise ValueError(f"Title too long: {card['title']}")
    for row, line in enumerate(lines):
        draw.text((64, 222 + row * (size + 12)), line, font=title_font, fill="#e9ebea")
    draw.line((64, 514, 1136, 514), fill="#343a3c", width=2)
    draw.text((64, 548), card["site"], font=small, fill="#b3bab9")
    language = card["language"]
    draw.text((1136 - draw.textlength(language, font=small), 548), language, font=small, fill="#6fb9c2")
    target = ASSETS / card["image"].lstrip("/")
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, optimize=True)


spec = json.load(sys.stdin)
for card in spec["cards"]:
    render(card, spec["width"], spec["height"])
manifest = ASSETS / "social" / "manifest.json"
manifest.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Generated {len(spec['cards'])} localized social cards")
