# Knitwit brand v2 — "arts & crafts": a knitted swatch (stockinette) as the mark,
# a woodblock-style serif wordmark (Young Serif), running-stitch details. No hearts, no faces.
import sys; sys.path.insert(0, 'gen')
from mark import C, svg
from stitch import stockinette
from word import wordmark

WORD_FONT = 'fonts/YoungSerif-Regular.woff'
BODY, _DOTS, W, ASC, UPM, XH, CAP = wordmark(font_path=WORD_FONT, tracking=8, keep_dots=True)
TOP = ASC - CAP
TERRA, CREAM, INK = C["coralDeep"], C["cream"], C["ink"]
PLY = "#F0C9AE"   # carved highlight inside a cream stitch on terracotta

# ---- the mark: a knitted swatch -------------------------------------------------
GRIDS = {
    # name: cols, rows, stitch w, h, row step, gap width (as fraction of w)
    "main":  (2, 3, 34, 38, 23.5, 0.09),
    "small": (2, 2, 32, 42, 26, 0.10),
    "icon":  (3, 4, 22, 26, 16, 0.07),
}
def stitches(grid="main", fg=CREAM, gap=TERRA, ply=None, seed=3, cx=50, cy=50, scale=1.0):
    cols, rows, w, h, sy, gw = GRIDS[grid]
    w, h, sy = w * scale, h * scale, sy * scale
    gw_total, gh_total = cols * w, (rows - 1) * sy + h
    return stockinette(cx - gw_total / 2, cy - gh_total / 2, cols, rows, w, h, fg, step_y=sy, seed=seed,
                       ply=ply, gap=gap, gapw=gw)

def tile(bg=TERRA, rx=24):
    return f'<rect x="0" y="0" width="100" height="100" rx="{rx}" fill="{bg}"/>'

def mark(grid="main", bg=TERRA, fg=CREAM, ply=None):
    return svg(tile(bg) + stitches(grid, fg=fg, gap=bg, ply=ply))

def mark_mono(color):
    # one-colour version: stitches knocked out of a solid tile, so it works on any background
    m = (f'<defs><mask id="ko"><rect width="100" height="100" fill="#fff"/>'
         + stitches("main", fg="#000", gap="#fff") + '</mask></defs>')
    return svg(m + f'<rect width="100" height="100" rx="24" fill="{color}" mask="url(#ko)"/>')

def stitches_only(color, grid="main"):
    return svg(stitches(grid, fg=color, gap="none"))

# ---- wordmark -------------------------------------------------------------------
PAD = 40
def word_group(ink=INK, dx=0, dy=0, scale=1):
    return f'<g transform="translate({dx} {dy}) scale({scale})"><path d="{BODY}" fill="{ink}"/></g>'

def wordmark_svg(ink=INK):
    return svg(word_group(ink), f"{-PAD} {TOP-PAD} {W+2*PAD} {CAP+2*PAD}")

def mark_group(d, x, y, inner):
    return f'<g transform="translate({x} {y}) scale({d/100})">{inner}</g>'

def _mark_inner(variant, color=None):
    if variant == "color": return tile() + stitches("main")
    if variant == "reversed": return tile(CREAM) + stitches("main", fg=TERRA, gap=CREAM)
    return (f'<defs><mask id="kol"><rect width="100" height="100" fill="#fff"/>' + stitches("main", fg="#000", gap="#fff")
            + f'</mask></defs><rect width="100" height="100" rx="24" fill="{color}" mask="url(#kol)"/>')

def lockup_h(variant="color", ink=INK, mono=None):
    D = 1000; GAP = 260
    y0 = TOP + CAP / 2 - D / 2 - 10
    m = mark_group(D, 0, y0, _mark_inner("mono" if mono else variant, mono))
    w = word_group(mono or ink, dx=D + GAP)
    return svg(m + w, f"{-PAD} {y0-PAD} {D+GAP+W+2*PAD} {D+2*PAD}")

def lockup_stacked(mono=None, ink=INK):
    D = 1400; gap = 300; total_w = max(D, W); mx = (total_w - D) / 2
    m = mark_group(D, mx, 0, _mark_inner("mono" if mono else "color", mono))
    w = word_group(mono or ink, dx=(total_w - W) / 2, dy=D + gap - TOP)
    return svg(m + w, f"{-PAD} {-PAD} {total_w+2*PAD} {D+gap+CAP+2*PAD}")

def text_path(text, font, tracking, size, cx, baseline, fill, opacity=1):
    """Outlined text (no font needed at render time), centred on cx with its baseline at `baseline`."""
    body, _d, w, asc, upm, *_ = wordmark(text, font_path=font, tracking=tracking, keep_dots=True)
    k = size / upm
    return (f'<g transform="translate({cx - w*k/2:.1f} {baseline - asc*k:.1f}) scale({k:.4f})" opacity="{opacity}">'
            f'<path d="{body}" fill="{fill}"/></g>')

def label(bg=TERRA, fg=CREAM, sub="KNIT  ·  CROCHET  ·  KEEP COUNT"):
    """A sewn-in woven label: notched ends, running-stitch border, wordmark centred."""
    Wd, Hd, notch = 5200, 1900, 300
    body = f'<path d="M0 0 H{Wd} L{Wd-notch} {Hd/2} L{Wd} {Hd} H0 L{notch} {Hd/2} Z" fill="{bg}"/>'
    i = 170
    stitch = (f'<path d="M{i+60} {i} H{Wd-i-60} L{Wd-notch-i+40} {Hd/2} L{Wd-i-60} {Hd-i} H{i+60} L{notch+i-40} {Hd/2} Z" '
              f'fill="none" stroke="{fg}" stroke-width="40" stroke-dasharray="150 115" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>')
    sc = 0.86; wx = (Wd - W * sc) / 2; wy = 360 - TOP * sc
    w = f'<g transform="translate({wx} {wy}) scale({sc})"><path d="{BODY}" fill="{fg}"/></g>'
    t = text_path(sub, 'fonts/Nunito_800ExtraBold.ttf', 160, 200, Wd/2, Hd - 470, fg, .9) if sub else ""
    return svg(body + stitch + w + t, f"-20 -20 {Wd+40} {Hd+40}")
