# Card Media Playbook — extracted rules

Source: Google "RCS for Business: Card Media Playbook", March 2026 (47 pages).
`[pN]` = PDF page number. Original: `../assets/CardMediaPlaybook_March2026.pdf`.

## Scope & disclaimer

- [p3] Defines essential aspect ratios and media sizes for all rich card and
  carousel formats, to minimize layout fragmentation.
- [p6] Guidelines assume Full HD (1080p) mid-range/premium devices. Custom
  ratios are possible "provided there is a clear understanding of card media
  cropping logic". Final rendering depends on screen size, text settings and
  OS → live-test on both platforms; responsibility rests with the brand.

## Android-only campaigns

### Vertical Rich Card [p8]

| Media size | Best aspect ratio | 1080p baseline | Optimized (3x) |
|---|---|---|---|
| Short | 7:2 | 3780x1080 | 1260x360 |
| Medium | 21:9 | 2520x1080 | 840x360 |
| Tall | 3:2 | 1620x1080 | 540x360 |

- [p8] These ratios give "almost 100% content visibility without auto-cropping".
- [p12] Custom resolutions get **center cropping** applied.

### Horizontal Rich Card [p13]

- Best aspect ratio 9:16 (1080x1920 baseline, 360x640 optimized 3x);
  15% edge safe zone = 918x1920 (baseline) / 306x640 (optimized).
- [p13] "The Horizontal Rich card utilizes a **fixed media width of 128dp**,
  while the height is **content-driven**, scaling dynamically to match the
  adjacent text block."
- [p13] "To mitigate vertical cropping… we recommend a 9:16 aspect ratio with
  a centered, 10-15% edge Safe Zone for critical media content… along with
  **short text block**."
- [p15, p16] Rendered media is "content-based, centered cropping".

### Small carousel [p17]

| Media size | Best aspect ratio | 1080p baseline | Optimized (3x) |
|---|---|---|---|
| Short | 16:10 | 1728x1080 | 576x360 |
| Medium | 1:1 | 1080x1080 | 360x360 |
| Tall | 2:3 | 720x1080 | 240x360 |

### Medium carousel [p22]

| Media size | Best aspect ratio | 1080p baseline | Optimized (3x) |
|---|---|---|---|
| Short | 8:3 | 2880x1080 | 960x360 |
| Medium | 16:9 | 1920x1080 | 640x360 |
| Tall | 9:8 | 1215x1080 | 405x360 |

- [p21, p26] Custom carousel media gets center cropping applied.

## iOS-only campaigns

- [p28] "Unlike Android, iOS does **not follow fixed media dimensions**
  (short, medium, tall) for vertical rich cards. Instead, it typically
  **preserves the native aspect ratio** of the uploaded asset, avoiding
  auto-cropping or distortion **unless the format is extreme (ultra-wide or
  portrait) or text content is long**."
- [p28] "Horizontal rich card media is **restricted to a 1:1 (square)** format."
- [p28] "Carousel media height is both aspect ratio and content-driven,
  scaling dynamically to match the adjacent text block."

### iOS media table [p29]

| Component type | Standard aspect ratio | 1080p baseline |
|---|---|---|
| Vertical Rich card | 3:2 or 4:3 | 1620x1080 or 1440x1080 |
| Horizontal Rich card | 1:1 | 1080x1080 |
| Carousel cards | 16:9 | 1920x1080 |

- [p29] Carousel note: use the SAME aspect ratio/resolution for every card;
  matching text lengths and CTA counts across cards minimizes height
  fluctuations and keeps the crop predictable.
- [p35] iOS carousel rendering depends on title/description length
  ("aspect ratio and content-driven").

## xPlatform campaigns

- [p39] iOS and Android "utilize distinct UI components and divergent
  cropping logic". Safe Zone definition: "the area where all critical content
  (logos, products, text overlays, or faces) must reside to prevent being
  cropped or obscured… reserve **5-10% of the image edge** as the buffer…
  keep critical content within the **central 80–90%** of the image's
  dimensions."

### xPlatform media table [p40]

| Component | Aspect ratio | 1080p baseline | 5% edge safe zone |
|---|---|---|---|
| Vertical Rich card (Tall variant only) | 3:2 | 1620x1080 | 1458x972 |
| Horizontal Rich card | 9:16 | 1080x1920 | 972x972 centered 1:1 critical media content area |
| Carousel cards (Medium variant only) | 16:9 | 1920x1080 | 1728x972 |

- [p40] Carousels: use ONLY medium carousel + medium media, same ratio and
  resolution on every card; match text lengths and CTA counts across cards.
