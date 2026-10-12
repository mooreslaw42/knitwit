# Knitwit mark generator — "yarn heart": two strands (blush + coral) loop into a heart and cross at a sage knot.
L = "M50 36 C45 27 38 24 31.5 24 C22.5 24 17 31 17 39.5 C17 52 32 61 50 71.5 C54 74 57.5 77 60.5 81"
R = "M50 36 C55 27 62 24 68.5 24 C77.5 24 83 31 83 39.5 C83 52 68 61 50 71.5 C46 74 42.5 77 39.5 81"
# heart geometry bbox (centre lines): x 17..83, y 24..81  -> centre (50, 52.5)
C = dict(blush="#F4C6D3", blushDeep="#E58AA0", coralDeep="#DE7C46", sageDeep="#7FA06D",
         cream="#FDF6EF", creamDeep="#F7EBDD", ink="#4A3B38", white="#FFFFFF", coral="#F0A67E", sage="#B9CFAD", butter="#F6E2A6", butterDeep="#E2B84A", lavender="#D9C9EA", lavenderDeep="#A985CC", inkSoft="#8A7873")

def heart(scale=0.78, sw=8, left=C["blushDeep"], right=C["coralDeep"], knot=C["sageDeep"], knot_r=6.5, cx=50, cy=50):
    # stroke width given in final units; compensate for scale
    s = scale
    tx, ty = cx - 50 * s, cy - 52.5 * s
    k = f'<circle cx="50" cy="71.5" r="{knot_r / s:.2f}" fill="{knot}"/>' if knot else ""
    return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s})" fill="none" stroke-width="{sw / s:.2f}" '
            f'stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="{L}" stroke="{left}"/><path d="{R}" stroke="{right}"/>{k}</g>')

def svg(inner, vb="0 0 100 100", extra=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" {extra}>{inner}</svg>\n'

def mark(bg=C["blush"], **kw):
    b = f'<circle cx="50" cy="50" r="50" fill="{bg}"/>' if bg else ""
    return svg(b + heart(**kw))
