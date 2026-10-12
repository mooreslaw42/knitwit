# Knitwit illustrations v2 — linocut-style craft still lifes. Solid natural-dye colours,
# cream "carved" highlight lines, running-stitch accents. No faces. viewBox 0 0 200 160.
import math
from mark import C
from stitch import stockinette

T, S, O, L, I, CR, CD = C["coralDeep"], C["sageDeep"], C["butterDeep"], C["lavenderDeep"], C["ink"], C["cream"], C["creamDeep"]
WOOD, WOOD_L = "#C99A55", "#E7C27C"
R = 'stroke-linecap="round" stroke-linejoin="round"'

def wrap(inner, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" role="img" aria-label="{title}">{inner}</svg>\n'

def ground(cx=100, w=120, y=140):
    return f'<ellipse cx="{cx}" cy="{y}" rx="{w/2}" ry="6" fill="{CD}"/>'

def running(d, col=I, w=2.6, op=.55):
    """A running stitch: dashed thread line."""
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-dasharray="7 6" {R} opacity="{op}"/>'

def ball(cx, cy, r, col=T, carve=CR, cid="b"):
    lines = (f'<g clip-path="url(#{cid})" fill="none" stroke="{carve}" stroke-width="{r*0.07:.2f}" {R} opacity=".85">'
             f'<path d="M{cx-r} {cy-r*.2} C{cx-r*.3} {cy-r*.45} {cx+r*.4} {cy+r*.1} {cx+r*.7} {cy+r}"/>'
             f'<path d="M{cx-r*.9} {cy+r*.05} C{cx-r*.25} {cy-r*.15} {cx+r*.25} {cy+r*.35} {cx+r*.4} {cy+r}"/>'
             f'<path d="M{cx-r*.7} {cy-r*.8} C{cx} {cy-r*.7} {cx+r*.7} {cy-r*.1} {cx+r} {cy+r*.45}"/>'
             f'<path d="M{cx-r*.1} {cy-r} C{cx+r*.35} {cy-r*.8} {cx+r*.8} {cy-r*.45} {cx+r} {cy-r*.05}"/></g>')
    return (f'<defs><clipPath id="{cid}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath></defs>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}"/>' + lines)

def needle(x1, y1, x2, y2, knob=True, w=5):
    out = (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{WOOD}" stroke-width="{w}" {R}/>'
           f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{WOOD_L}" stroke-width="{w*0.35:.2f}" {R} transform="translate(-0.8 -0.8)"/>')
    if knob: out += f'<circle cx="{x2}" cy="{y2}" r="{w*1.05:.2f}" fill="#A87A3A"/>'
    return out

def sparkle(x, y, s, col):  # small four-point "shine", carved look
    return f'<path transform="translate({x} {y}) scale({s})" d="M0 -6 L1.3 -1.3 L6 0 L1.3 1.3 L0 6 L-1.3 1.3 L-6 0 L-1.3 -1.3Z" fill="{col}"/>'

ILLUS = {}

# 1. No projects — a fresh ball of yarn with two needles pushed through, ready to cast on
ILLUS["no-projects"] = wrap(
    ground(100, 110) +
    needle(66, 122, 128, 32) + ball(100, 96, 34, cid="np") + needle(140, 118, 82, 34) +
    running("M128 128 C146 136 160 126 176 132", T, 3.2, .9),
    "A ball of yarn with two knitting needles, ready to cast on")

# 2. No patterns — an open pattern booklet with a stitch chart
def chart(x0, y0, cols, rows, cell, filled, col):
    out = ""
    for r in range(rows):
        for c in range(cols):
            f = col if (c, r) in filled else "none"
            out += f'<rect x="{x0+c*cell}" y="{y0+r*cell}" width="{cell}" height="{cell}" fill="{f}" stroke="{col}" stroke-width=".9" opacity="{1 if f!="none" else .55}"/>'
    return out
book = (f'<path d="M100 44 C84 36 62 34 42 38 V128 C62 124 84 126 100 134 C116 126 138 124 158 128 V38 C138 34 116 36 100 44Z" fill="{CR}" stroke="{I}" stroke-width="3" {R}/>'
        f'<path d="M100 44 V134" stroke="{I}" stroke-width="3" {R}/>'
        f'<path d="M54 54 H88 M54 64 H84 M54 74 H88 M54 84 H80 M54 94 H88 M54 104 H76" stroke="{I}" stroke-width="2.4" opacity=".35" {R}/>'
        + chart(110, 52, 6, 6, 6.6, {(1,0),(2,1),(3,2),(4,3),(1,4),(2,5),(4,0),(3,1),(2,2),(1,3),(4,4),(3,5)}, L))
ILLUS["no-patterns"] = wrap(ground(100, 130, 140) + book +
    f'<g transform="rotate(-32 150 120)"><rect x="140" y="80" width="9" height="50" rx="1.5" fill="{O}"/><path d="M140 130 L144.5 140 L149 130Z" fill="{CR}" stroke="{O}" stroke-width="1.5"/><rect x="140" y="76" width="9" height="7" rx="1.5" fill="{T}"/></g>',
    "An open pattern booklet with a stitch chart and a pencil")

# 3. Empty stash — a woven basket, empty, with one loose strand
basket = (f'<path d="M48 86 H152 L142 132 A8 8 0 0 1 134 138 H66 A8 8 0 0 1 58 132Z" fill="{O}"/>'
          f'<g fill="none" stroke="#B98C2C" stroke-width="2.4" {R}>'
          + "".join(f'<path d="M{51+i*1.6:.1f} {98+i*12} H{149-i*1.6:.1f}"/>' for i in range(3)) +
          "".join(f'<path d="M{62+i*12.5:.1f} 90 L{64+i*11.5:.1f} 136"/>' for i in range(7)) +
          f'</g><g fill="none" stroke="{CR}" stroke-width="2.4" opacity=".7" {R}>'
          + "".join(f'<path d="M{68+i*12.5:.1f} {92+ (i%2)*12} v8"/>' for i in range(6)) +
          f'</g><path d="M42 86 H158" stroke="#B98C2C" stroke-width="7" {R}/>'
          f'<path d="M64 86 C64 52 136 52 136 86" fill="none" stroke="#B98C2C" stroke-width="5" {R}/>')
ILLUS["no-materials"] = wrap(ground(100, 120) + basket + running("M150 120 C166 112 172 126 186 118", S, 3.2, .9),
    "An empty woven basket")

# 4. No tools — a fabric needle roll, unrolled, pockets mostly empty
roll = (f'<rect x="34" y="52" width="132" height="78" rx="6" fill="{S}"/>'
        f'<rect x="34" y="92" width="132" height="38" rx="4" fill="#6C8C5B"/>'
        + "".join(f'<path d="M{48+i*17} 94 V128" stroke="{CR}" stroke-width="2.2" stroke-dasharray="4 4" opacity=".75" {R}/>' for i in range(7))
        + running("M40 58 H160", CR, 2.2, .7) +
        needle(72, 120, 80, 60, knob=True, w=4) +
        f'<path d="M108 122 L116 62" stroke="{L}" stroke-width="4" {R}/><path d="M116 62 c1.5-3 -1.5-5 -3-3" fill="none" stroke="{L}" stroke-width="3" {R}/>'
        f'<path d="M166 70 C182 70 184 88 172 92" fill="none" stroke="{T}" stroke-width="3" {R}/>')
ILLUS["no-tools"] = wrap(ground(100, 140, 140) + roll, "An unrolled needle case with only a needle and a hook")

# 5. No notes — a notebook, pencil and a curl of tape measure
note = (f'<rect x="56" y="34" width="78" height="100" rx="5" fill="{L}"/>'
        f'<rect x="64" y="34" width="70" height="100" rx="3" fill="{CR}"/>'
        f'<path d="M74 56 H122 M74 70 H122 M74 84 H112 M74 98 H118" stroke="{I}" stroke-width="2.2" opacity=".28" {R}/>'
        + "".join(f'<circle cx="60" cy="{44+i*14}" r="2.4" fill="{CR}"/>' for i in range(7)) +
        f'<g transform="rotate(28 150 92)"><rect x="146" y="50" width="9" height="56" rx="1.5" fill="{O}"/><path d="M146 106 L150.5 117 L155 106Z" fill="{CR}" stroke="{O}" stroke-width="1.5"/><rect x="146" y="46" width="9" height="7" rx="1.5" fill="{T}"/></g>'
        )
ILLUS["no-notes"] = wrap(ground(100, 130) + note, "A notebook and a pencil")

# 6. Nothing here — a needle with just a cast-on row, no fabric yet
loops = "".join(f'<path d="M{62+i*12} 74 c-5 6 -5 16 0 18 c5 -2 5 -12 0 -18" fill="none" stroke="{T}" stroke-width="4" {R}/>' for i in range(7))
ILLUS["nothing-here"] = wrap(ground(100, 110) + needle(38, 78, 166, 70, w=5.5) + loops +
    ball(146, 116, 18, cid="nh") + running("M136 100 C120 92 108 98 96 94", T, 3.2, .9),
    "A needle with a cast-on row and nothing knitted yet")

# 7. Celebrate — a finished, blocked swatch pinned flat, with a prize rosette
sw = (f'<rect x="44" y="34" width="96" height="96" rx="4" fill="{T}"/>'
      + stockinette(50, 38, 4, 5, 21, 25, CR, step_y=17.5, seed=21, gap=T, gapw=0.08, ply="#F0C9AE"))
pins = "".join(f'<path d="M{x} {y} l{dx} {dy}" stroke="#9AA3A8" stroke-width="2" {R}/><circle cx="{x}" cy="{y}" r="4" fill="{c}"/>'
               for x, y, dx, dy, c in [(42, 32, 7, 7, S), (142, 32, -7, 7, O), (42, 132, 7, -7, L), (142, 132, -7, -7, S)])
ros = (f'<path d="M150 112 L142 146 L150 140 L156 148 L160 114Z" fill="{L}"/><path d="M166 112 L172 146 L164 140 L158 148 L156 114Z" fill="#8F6AB5"/>'
       + "".join(f'<circle cx="{158+15*math.cos(a/12*2*math.pi):.1f}" cy="{98+15*math.sin(a/12*2*math.pi):.1f}" r="5.5" fill="{O}"/>' for a in range(12))
       + f'<circle cx="158" cy="98" r="15" fill="{O}"/><circle cx="158" cy="98" r="9" fill="{CR}"/>'
       f'<path d="M154 98 l3 3 6-6" fill="none" stroke="{S}" stroke-width="2.6" {R}/>')
ILLUS["celebrate"] = wrap(ground(100, 130, 146) + sw + pins + ros, "A finished, pinned swatch with a prize rosette")

# 8. Thinking / loading — a ball unwinding into a pattern chart
ILLUS["thinking"] = wrap(ground(100, 130) + ball(64, 108, 26, col=L, cid="th") +
    running("M86 120 C104 128 112 104 128 108", L, 3.2, .9) +
    f'<rect x="120" y="44" width="56" height="70" rx="4" fill="{CR}" stroke="{I}" stroke-width="2.6"/>' +
    chart(128, 52, 5, 6, 8, {(0,0),(1,1),(2,2),(3,3),(4,4),(0,4),(4,0)}, L) +
    sparkle(108, 54, 1.4, O) + sparkle(98, 74, .8, T),
    "A ball of yarn unwinding into a pattern chart")

def skein(hex_color, size=120):
    # unchanged: placeholder ball in a yarn's own colour (port of yarnPlaceholderPhoto)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><clipPath id="sk"><circle cx="60" cy="60" r="50"/></clipPath></defs>'
            f'<circle cx="60" cy="60" r="50" fill="{hex_color}"/>'
            f'<g clip-path="url(#sk)" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round">'
            f'<path d="M10 48 C30 42 60 58 78 112"/><path d="M22 22 C48 26 80 50 100 92"/><path d="M50 10 C70 18 92 38 106 66"/><path d="M14 74 C30 70 44 84 52 110"/></g></svg>')
