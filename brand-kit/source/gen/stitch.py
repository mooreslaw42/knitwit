# Knit-stitch geometry: a knit "V" is two leaning loops (legs). Stockinette = columns of Vs.
import math, random
from mark import C

def leg(cx, cy, w, h, side, fill, rot=24, ply=None, jitter=None, fat=0.25, spread=0.25, tall=0.5, gap=None, gapw=0.07):
    """One leg of a V stitch: a plump leaning loop. side=-1 left, +1 right."""
    r = random.Random(jitter) if jitter is not None else None
    jr = (r.uniform(-2, 2) if r else 0)
    js = (1 + r.uniform(-0.035, 0.035)) if r else 1
    lx = cx + side * w * spread
    rx_, ry_ = w * fat * js, h * tall * js
    angle = side * -(rot + jr)   # legs lean in at the bottom: left leg tilts right-down
    out = f'<ellipse cx="{lx:.2f}" cy="{cy:.2f}" rx="{rx_:.2f}" ry="{ry_:.2f}" fill="{fill}"' + (f' stroke="{gap}" stroke-width="{w*gapw:.2f}"' if gap else '') + f' transform="rotate({angle:.2f} {lx:.2f} {cy:.2f})"/>'
    if ply:
        pd = f"M{lx-rx_*0.15:.2f} {cy-ry_*0.62:.2f} C{lx+rx_*0.45:.2f} {cy-ry_*0.2:.2f} {lx+rx_*0.4:.2f} {cy+ry_*0.25:.2f} {lx+rx_*0.05:.2f} {cy+ry_*0.62:.2f}"
        out += f'<path d="{pd}" fill="none" stroke="{ply}" stroke-width="{w*0.04:.2f}" stroke-linecap="round" transform="rotate({angle:.2f} {lx:.2f} {cy:.2f})"/>'
    return out

def vstitch(cx, cy, w, h, fill, **kw):
    seed = kw.pop("seed", None)
    return (leg(cx, cy, w, h, -1, fill, jitter=None if seed is None else seed * 2, **kw) +
            leg(cx, cy, w, h, +1, fill, jitter=None if seed is None else seed * 2 + 1, **kw))

def stockinette(x0, y0, cols, rows, w, h, fill, step_y=None, seed=None, **kw):
    step_y = step_y or h * 0.82
    out = ""
    for r in range(rows):
        for c in range(cols):
            s = None if seed is None else seed + r * 31 + c
            out += vstitch(x0 + c * w + w / 2, y0 + r * step_y + h / 2, w, h, fill, seed=s, **kw)
    return out
