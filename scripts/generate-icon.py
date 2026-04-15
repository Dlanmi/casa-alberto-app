#!/usr/bin/env python3
"""
Generador del icono de la app Casa Alberto.

Crea los 3 archivos que consume electron-builder:
  - build/icon.icns  (macOS)
  - build/icon.ico   (Windows, multi-tamaño embebido)
  - build/icon.png   (Linux, 512x512)
  - resources/icon.png (usado por BrowserWindow en Linux)

El diseño es un cuadrado redondeado con "CA" en blanco sobre fondo ámbar
(#b45309), coherente con el logo del sidebar. Para cambiar el diseño,
edita los valores en la sección CONFIG de abajo y vuelve a correr:

    python3 scripts/generate-icon.py

Requisitos:
  - Python 3 con Pillow (pip install Pillow)
  - iconutil (viene con macOS, necesario para el .icns)

Ejecutar desde la raíz del proyecto.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print('ERROR: necesitas Pillow. Instala con: pip install Pillow')
    sys.exit(1)


# ============================== CONFIG ==============================
TEXT = 'CA'
BG_COLOR = (180, 83, 9, 255)      # #b45309 - accent ámbar del proyecto
FG_COLOR = (255, 255, 255, 255)   # blanco
MASTER_SIZE = 1024
CORNER_RADIUS_PCT = 21.5          # 21.5% del lado (estilo iOS)
FONT_SIZE_PCT = 50.8              # 50.8% del lado
OPTICAL_Y_OFFSET_PCT = -1.0       # ajuste óptico vertical
# ====================================================================


def find_font() -> ImageFont.FreeTypeFont:
    font_paths = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/SFNSDisplay-Bold.otf',
        '/System/Library/Fonts/Avenir.ttc',
        '/Library/Fonts/Arial Bold.ttf',
        # Linux fallbacks
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
    ]
    font_size = int(MASTER_SIZE * FONT_SIZE_PCT / 100)
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, font_size)
            except Exception:
                continue
    print('WARN: ninguna fuente bold encontrada, usando default')
    return ImageFont.load_default()


def render_master() -> Image.Image:
    img = Image.new('RGBA', (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    corner = int(MASTER_SIZE * CORNER_RADIUS_PCT / 100)
    draw.rounded_rectangle(
        [(0, 0), (MASTER_SIZE, MASTER_SIZE)],
        radius=corner,
        fill=BG_COLOR
    )
    font = find_font()
    bbox = draw.textbbox((0, 0), TEXT, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (MASTER_SIZE - text_w) / 2 - bbox[0]
    y = (MASTER_SIZE - text_h) / 2 - bbox[1]
    y += MASTER_SIZE * OPTICAL_Y_OFFSET_PCT / 100
    draw.text((x, y), TEXT, fill=FG_COLOR, font=font)
    return img


def generate_icns(master: Image.Image, out: Path, tmp: Path) -> None:
    iconset = tmp / 'icon.iconset'
    iconset.mkdir(parents=True, exist_ok=True)
    mapping = [
        (16, '16x16'), (32, '16x16@2x'),
        (32, '32x32'), (64, '32x32@2x'),
        (128, '128x128'), (256, '128x128@2x'),
        (256, '256x256'), (512, '256x256@2x'),
        (512, '512x512'), (1024, '512x512@2x')
    ]
    for size, name in mapping:
        master.resize((size, size), Image.LANCZOS).save(iconset / f'icon_{name}.png', 'PNG')
    subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(out)], check=True)
    print(f'  ✓ {out}')


def generate_ico(master: Image.Image, out: Path) -> None:
    # Windows ICO soporta múltiples tamaños embebidos.
    # Le damos los que Windows usa: Explorer, Taskbar, notificaciones.
    base = master.resize((256, 256), Image.LANCZOS)
    base.save(
        out,
        format='ICO',
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print(f'  ✓ {out}')


def generate_png(master: Image.Image, out: Path, size: int = 512) -> None:
    master.resize((size, size), Image.LANCZOS).save(out, 'PNG')
    print(f'  ✓ {out}')


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    build = root / 'build'
    resources = root / 'resources'
    build.mkdir(exist_ok=True)
    resources.mkdir(exist_ok=True)
    tmp = Path('/tmp/ca-icon-gen')
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)

    print(f'Generando icono "{TEXT}" con fondo rgba{BG_COLOR}...')
    master = render_master()
    master.save(tmp / 'master.png', 'PNG')

    print('Escribiendo archivos:')
    generate_icns(master, build / 'icon.icns', tmp)
    generate_ico(master, build / 'icon.ico')
    generate_png(master, build / 'icon.png', 512)
    generate_png(master, resources / 'icon.png', 512)

    shutil.rmtree(tmp)
    print('\nListo. Para aplicar los cambios, regenera el build:')
    print('  npm run build')
    print('  (y en Windows) npm run build:win')


if __name__ == '__main__':
    main()
