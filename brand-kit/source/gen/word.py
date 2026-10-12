import sys, re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

def glyph_contours(font, ch):
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); name = cmap[ord(ch)]
    rec = DecomposingRecordingPen(gs); gs[name].draw(rec)
    # split into contours
    contours, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"): contours.append(cur); cur = []
    return contours, gs[name].width

def contour_path(contour, dx, upm_y):
    pen = SVGPathPen(None)
    for op, args in contour:
        pts = [(x + dx, upm_y - y) for (x, y) in args]  # flip y
        getattr(pen, op)(*pts)
    return pen.getCommands()

def contour_bounds(contour):
    xs=[p[0] for op,a in contour for p in a]; ys=[p[1] for op,a in contour for p in a]
    return min(xs),min(ys),max(xs),max(ys)

def wordmark(text="Knitwit", font_path="fonts/Quicksand_700Bold.ttf", tracking=-12, keep_dots=False):
    f = TTFont(font_path); asc = f["hhea"].ascent
    x = 0; body = []; dots = []
    for ch in text:
        cs, adv = glyph_contours(f, ch)
        for c in cs:
            b = contour_bounds(c)
            # tittle of i: small contour sitting above x-height
            if ch == "i" and b[1] > 520 and not keep_dots:
                dots.append(((b[0]+b[2])/2 + x, asc - (b[1]+b[3])/2, (b[2]-b[0])/2))
            else:
                body.append(contour_path(c, x, asc))
        x += adv + tracking
    width = x - tracking
    return " ".join(body), dots, width, asc, f["head"].unitsPerEm, f["OS/2"].sxHeight, f["OS/2"].sCapHeight
if __name__ == "__main__":
    b, dots, w, asc, upm, xh, cap = wordmark()
    print(w, asc, upm, xh, cap, dots)
