import sys, os, json, shutil, subprocess
sys.path.insert(0, 'gen')
from mark import C, svg
from brand2 import *
from stitch import stockinette
from icons import ICONS, GROUPS, icon_svg, el
from illus2 import ILLUS, skein

OUT = 'out/brand-kit'
REPO = f'{OUT}/repo'
shutil.rmtree(OUT, ignore_errors=True)
JOBS = []
def w(path, content):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'w').write(content)
def png(svgpath, out, wpx, hpx=None, opaque=False):
    JOBS.append({"svg": svgpath, "out": out, "w": wpx, "h": hpx or wpx, "opaque": opaque})

# ---------- 1. LOGO ----------
L = f'{OUT}/logo'
w(f'{L}/knitwit-mark.svg', mark("main"))
w(f'{L}/knitwit-mark-small.svg', mark("small"))
w(f'{L}/knitwit-mark-reversed.svg', mark("main", bg=CREAM, fg=TERRA))
w(f'{L}/knitwit-mark-ink.svg', mark_mono(INK))
w(f'{L}/knitwit-mark-white.svg', mark_mono("#FFFFFF"))
w(f'{L}/knitwit-stitches.svg', stitches_only(TERRA))
w(f'{L}/knitwit-wordmark.svg', wordmark_svg())
w(f'{L}/knitwit-wordmark-white.svg', wordmark_svg("#FFFFFF"))
w(f'{L}/knitwit-wordmark-cream.svg', wordmark_svg(CREAM))
w(f'{L}/knitwit-lockup.svg', lockup_h())
w(f'{L}/knitwit-lockup-ink.svg', lockup_h(mono=INK))
w(f'{L}/knitwit-lockup-white.svg', lockup_h(mono="#FFFFFF"))
w(f'{L}/knitwit-lockup-reversed.svg', lockup_h("reversed", ink=CREAM))
w(f'{L}/knitwit-lockup-stacked.svg', lockup_stacked())
w(f'{L}/knitwit-label.svg', label())
w(f'{L}/knitwit-label-cream.svg', label(bg=CREAM, fg=TERRA))
for n, sz in [("knitwit-mark", [256, 512, 1024]), ("knitwit-mark-small", [64, 128])]:
    for s_ in sz: png(f'{L}/{n}.svg', f'{L}/png/{n}-{s_}.png', s_)
png(f'{L}/knitwit-lockup.svg', f'{L}/png/knitwit-lockup-1200.png', 1200, None)
png(f'{L}/knitwit-lockup-stacked.svg', f'{L}/png/knitwit-lockup-stacked-800.png', 800, None)
png(f'{L}/knitwit-wordmark.svg', f'{L}/png/knitwit-wordmark-1200.png', 1200, None)
png(f'{L}/knitwit-label.svg', f'{L}/png/knitwit-label-1200.png', 1200, None)

# aspect ratios for non-square renders
def vb_ratio(path):
    import re
    vb = re.search(r'viewBox="([^"]+)"', open(path).read()).group(1).split()
    return float(vb[3]) / float(vb[2])
for j in JOBS:
    if j["svg"].endswith(("lockup.svg", "lockup-stacked.svg", "wordmark.svg", "label.svg")) and j["w"] >= 800:
        j["h"] = round(j["w"] * vb_ratio(j["svg"]))

# ---------- 2. APP ICONS ----------
A = f'{REPO}/assets'
GAP_MID = "#DA7944"   # mid-tone of the terracotta gradient, used for the carved gaps between stitches
GRAD = ('<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E38752"/>'
        '<stop offset="1" stop-color="#D2703C"/></linearGradient></defs>')
def app_icon_svg(bg=True, scale=1.0):
    b_ = '<rect width="100" height="100" fill="url(#g)"/>' if bg else ''
    return svg(GRAD + b_ + stitches("icon", ply=PLY, gap=GAP_MID, scale=scale))
w(f'{OUT}/src/app-icon.svg', app_icon_svg())
png(f'{OUT}/src/app-icon.svg', f'{A}/images/icon.png', 1024, opaque=True)

# iOS 26 Icon Composer bundle — the stitches as one layer on a 1024 canvas over a terracotta fill.
def layer(inner):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">{inner}</svg>\n'
w(f'{A}/knitwit.icon/Assets/stitches.svg', layer(stitches("icon", ply=PLY, gap=GAP_MID)))
icon_json = {
  "fill": {"automatic-gradient": "extended-srgb:0.87059,0.48627,0.27451,1.00000"},
  "groups": [{
    "layers": [{"image-name": "stitches.svg", "name": "stitches"}],
    "shadow": {"kind": "neutral", "opacity": 0.5},
    "translucency": {"enabled": True, "value": 0.2}}],
  "supported-platforms": {"circles": ["watchOS"], "squares": "shared"}}
w(f'{A}/knitwit.icon/icon.json', json.dumps(icon_json, indent=2) + "\n")

# Android adaptive icon (108dp canvas; art inside the central 66dp safe circle)
w(f'{OUT}/src/android-fg.svg', svg(stitches("icon", ply=PLY, gap=GAP_MID, scale=0.66)))
w(f'{OUT}/src/android-bg.svg', svg(GRAD + '<rect width="100" height="100" fill="url(#g)"/>'))
mono_mask = ('<defs><mask id="m"><rect width="100" height="100" fill="#000"/>'
             + stitches("icon", fg="#fff", gap="#000", scale=0.66) + '</mask></defs>')
w(f'{OUT}/src/android-mono.svg', svg(mono_mask + '<rect width="100" height="100" fill="#000" mask="url(#m)"/>'))
png(f'{OUT}/src/android-fg.svg', f'{A}/images/android-icon-foreground.png', 1024)
png(f'{OUT}/src/android-bg.svg', f'{A}/images/android-icon-background.png', 1024, opaque=True)
png(f'{OUT}/src/android-mono.svg', f'{A}/images/android-icon-monochrome.png', 1024)
# Splash (shown on cream, centred) + legacy favicon
png(f'{L}/knitwit-mark.svg', f'{A}/images/splash-icon.png', 1024)
png(f'{L}/knitwit-mark-small.svg', f'{A}/images/favicon.png', 48)

# ---------- 3. WEB ----------
P = f'{REPO}/public'
w(f'{P}/brand/favicon.svg', mark("small"))
for s in (16, 32, 48): png(f'{L}/knitwit-mark-small.svg', f'{OUT}/src/fav-{s}.png', s)
png(f'{OUT}/src/app-icon.svg', f'{P}/brand/apple-touch-icon.png', 180, opaque=True)
w(f'{OUT}/src/maskable.svg', app_icon_svg(scale=0.82))   # stitches inside the 80% maskable safe zone
png(f'{OUT}/src/maskable.svg', f'{P}/brand/icon-512-maskable.png', 512, opaque=True)
png(f'{L}/knitwit-mark.svg', f'{P}/brand/icon-192.png', 192)
png(f'{L}/knitwit-mark.svg', f'{P}/brand/icon-512.png', 512)
w(f'{P}/brand/site.webmanifest', json.dumps({
  "name": "Knitwit", "short_name": "Knitwit",
  "description": "Your cozy knitting & crochet companion — row counter, patterns, projects and stash.",
  "start_url": "/", "display": "standalone", "orientation": "portrait",
  "background_color": C["cream"], "theme_color": C["cream"],
  "icons": [
    {"src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "/brand/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, indent=2) + "\n")

# Social share image (1200x630)
FONTCSS = ''.join(f"@font-face{{font-family:'{fam}';font-weight:{wt};src:url('file://{os.path.abspath('fonts/'+f)}')}}" for fam, wt, f in
                  [("Quicksand", 700, "Quicksand_700Bold.ttf"), ("Nunito", 700, "Nunito_700Bold.ttf"), ("Nunito", 800, "Nunito_800ExtraBold.ttf")])
import re
def inline(svgtxt, wpx, hpx=None, style=""):
    return svgtxt.replace('<svg ', f'<svg width="{wpx}" ' + (f'height="{hpx}" ' if hpx else '') + f'style="{style}" ', 1)
band = stockinette(-14, -6, 30, 5, 42, 50, CREAM, step_y=31, seed=41, gap=TERRA, gapw=0.08, ply=PLY)
og = f'''<html><head><style>{FONTCSS} html,body{{margin:0}} .c{{width:1200px;height:630px;background:{C["cream"]};position:relative;overflow:hidden;font-family:Nunito}}
.t{{position:absolute;left:0;right:0;top:330px;text-align:center;font-weight:800;font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:{C["inkSoft"]}}}</style></head><body><div class="c">
<div style="position:absolute;left:0;right:0;top:150px;display:flex;justify-content:center">{inline(lockup_h(), 620)}</div>
<div class="t">Your knitting &amp; crochet companion</div>
<svg width="1200" height="200" viewBox="0 0 1200 200" style="position:absolute;left:0;bottom:0">
  <path d="M0 26 H1200" stroke="{C["ink"]}" stroke-width="5" stroke-dasharray="22 16" stroke-linecap="round" opacity=".45"/>
  <rect x="0" y="52" width="1200" height="160" fill="{TERRA}"/>
  <g transform="translate(0 62)">{band}</g>
</svg>
</div></body></html>'''
w(f'{OUT}/src/og.html', og)
JOBS.append({"html": f'{OUT}/src/og.html', "out": f'{P}/brand/og-image.png', "w": 1200, "h": 630, "opaque": True})

# ---------- 4. ICONS ----------
for n in ICONS: w(f'{OUT}/icons/svg/{n}.svg', icon_svg(n) + "\n")
# TS data: elements as tuples so react-native-svg can render them natively (no XML parsing at runtime)
def ts_icon_data():
    lines = ["// Generated by brand-kit — Knitwit icon set (24px grid, 2px rounded strokes, soft duotone).",
             "// S = stroke, D = duotone fill (light tint), F = solid fill.", "",
             "export type IconPart = readonly ['S' | 'D' | 'F', 'path' | 'circle' | 'rect', string];", "",
             "export const KNIT_ICONS = {"]
    for n, parts in ICONS.items():
        ps = ", ".join("[" + json.dumps(k) + ", " + json.dumps(t) + ", " + json.dumps(d) + "]" for k, t, d in parts)
        lines.append(f"  {json.dumps(n)}: [{ps}],")
    lines += ["} as const satisfies Record<string, readonly IconPart[]>;", "",
              "export type KnitIconName = keyof typeof KNIT_ICONS;", ""]
    return "\n".join(lines)
w(f'{REPO}/src/components/icons/knit-icon-data.ts', ts_icon_data())

# ---------- 5. ILLUSTRATIONS ----------
for n, s in ILLUS.items(): w(f'{OUT}/illustrations/svg/{n}.svg', s)
def ts_illus():
    lines = ["// Generated by brand-kit — Knitwit illustrations: linocut-style craft still lifes (viewBox 0 0 200 160).", "",
             "export const ILLUSTRATIONS = {"]
    for n, s in ILLUS.items():
        lines.append(f"  {json.dumps(n)}: {json.dumps(s.strip())},")
    lines += ["} as const;", "", "export type IllustrationName = keyof typeof ILLUSTRATIONS;", ""]
    return "\n".join(lines)
w(f'{REPO}/src/components/illustrations/illustration-data.ts', ts_illus())

# ---------- 6. LOGO DATA for in-app use ----------
def ts_logo():
    items = {"mark": mark("main"), "markSmall": mark("small"), "lockup": lockup_h(), "lockupStacked": lockup_stacked(),
             "wordmark": wordmark_svg(), "lockupInk": lockup_h(mono=C["ink"]), "label": label()}
    lines = ["// Generated by brand-kit — Knitwit logo SVGs for in-app rendering.", "", "export const LOGO_SVGS = {"]
    for k, v in items.items(): lines.append(f"  {k}: {json.dumps(v.strip())},")
    lines += ["} as const;", "", "export type LogoVariant = keyof typeof LOGO_SVGS;", ""]
    return "\n".join(lines)
w(f'{REPO}/src/components/brand/logo-svgs.ts', ts_logo())

json.dump(JOBS, open('out/build-jobs.json', 'w'))
print(len(JOBS), "render jobs")

# login page + anywhere outside the app that needs the logo as a file
shutil.copy(f'{L}/knitwit-lockup.svg', f'{P}/brand/knitwit-lockup.svg')
shutil.copy(f'{L}/knitwit-mark.svg', f'{P}/brand/knitwit-mark.svg')
shutil.copytree('handwritten', OUT + '/repo', dirs_exist_ok=True)
