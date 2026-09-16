# MindLab report fonts

Noto Sans CJK KR Regular and Bold, SIL Open Font License 1.1. See LICENSE.txt for
the original Debian-distributed copyright/license notice. These assets are served
from this application; export never fetches a font from a third party.

Derived from `/usr/share/fonts/opentype/noto/NotoSansCJK-{Regular,Bold}.ttc`, Korean
face index 1, with fontTools/WOFF2. The subset retains all modern Hangul syllables,
Hangul Jamo, extended Jamo, Latin, and the punctuation used by the report. Other
scripts in participant names use the browser's fallback font.

Reproduction (requires fontTools and Brotli):

```sh
for style in Regular Bold; do
  pyftsubset "/usr/share/fonts/opentype/noto/NotoSansCJK-$style.ttc" \
    --font-number=1 \
    --unicodes='U+0000-024F,U+1100-11FF,U+2000-206F,U+3000-303F,U+3130-318F,U+A960-A97F,U+AC00-D7FF,U+FF00-FFEF' \
    --flavor=woff2 \
    --output-file="client/public/fonts/mindlab/NotoSansCJKkr-$style.woff2"
done
```
