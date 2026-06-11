# X-Platform Playbook — extracted rules

Source: Google "RCS for Business: X-Platform Playbook", April 2026 (47 pages),
"created to help bridge UX gaps between iOS 26.2 and Android" [s2].
`[sN]` = slide/PDF page number. Original: `../assets/xPlatformPlaybook_April2026.pdf`.

## Recommended cross-platform pattern [s11]

- Rich Card: **3:2 media with min. 5% safe zone**, "Tall" media type,
  **3 lines of title & description text max**, **a single CTA** (suggested
  action), up to 3 suggested replies.
- Carousel: **16:9 media with min. 5% safe zone**, "Medium" width with
  "Medium" media height, same 3-line / single-CTA guidance.
- Footnote: "The content displayed within those three lines can vary
  depending on the device's font size settings and screen orientation;
  **GIFs are not animated in iOS**."

## Media geometry & safe zones

- [s12] Vertical Rich Card media: 3:2 (e.g. 1620x1080), min. 5% safe zone =
  1458x972 — "critical media content should be placed here".
- [s12] Carousel media: 16:9 (e.g. 1920x1080), min. 5% safe zone = 1728x972.
- [s12] "Images will not be cropped with the default text setting when the
  device is in portrait mode for both Android and iOS. However, cropping may
  still occur if the device is rotated to landscape mode or when the user
  sets a larger text display."
- [s13] Vertical Rich Card: "Use only the **'Tall' media type** to minimize
  media rendering difference across iOS and Android."
- [s15] **Horizontal Rich Card** (the compact format): 9:16 media with min.
  5% safe zone + centered 1:1 critical media content area — with caveats:
  - "**iOS renders the media at 60x60 DP.**"
  - "**On Android, vertical cropping becomes more severe with longer texts.**"
- [s16] Horizontal Rich Card media: 9:16 (e.g. 1080x1920); min. 5% safe zone
  (972x1728); **1:1 critical media content area (972x972 px)** — critical
  content must be placed there.
- [s28, s29] "iOS supports portrait media - ie. 2:3, 9:16, as well as
  non-standard portrait aspect ratios. **Android applies center cropping to
  all portrait media.**"
- [s30] "iOS supports variable media sizes within a single carousel; carousel
  size changes depending on media size, as well as the title & description
  text length. Android renders consistent carousel and media sizes by
  applying center cropping."

## Text truncation & overflow

- [s13] "**Longer texts will get truncated on iOS.** The content displayed
  within recommended three lines of text can vary depending on the device's
  font size settings and screen orientation." (repeated on s14, s15)
- [s14] Carousels: "Longer texts will get truncated on iOS **and additional
  media cropping will be applied**."
- [s23] iOS rich cards: "If the title and description texts exceed **6 lines
  in total**, the entire rich card becomes tappable to show a separate page
  to display the full text content (**200 chars for Title and 2000 for
  Description**). **Media and Suggestions are not included in this view.**"
- [s24] Same 6-line rule for iOS carousels.
- [s25] Android: "if the carousel card content exceeds the maximum card
  length (**576px**), the entire card text area becomes tappable to show a
  separate page… (200 chars Title / 2000 Description). Media and Suggestions
  ARE included in this view" (unlike iOS).

## Suggestions (actions & replies)

- [s17] Rich card suggestions: "**Up to 4 suggestions: 1 action and up to 3
  replies**"; "**25 characters max per each suggestion**"; "Place action
  before replies"; don't combine rich-card suggestions with message
  suggestions in one turn.
- [s17] Message suggestions: up to 11, replies only, 25 chars max, text
  messages only.
- [s19] Supported actions identical on both platforms (Call, View location,
  Share location, Add to calendar, Open link in browser / webview); icons
  chosen automatically by the OS.
- [s21] "For maximum parity, place suggested action as the first option,
  since iOS always places actions above replies."
- [s31/s35/s39] iOS: actions are permanent, displayed inside the card, and
  "hidden under **'Options' dropdown if more than 2**". Android: transient
  chips that disappear after the next message.
- [s42] Summary: "**iOS always places all suggested actions as an expandable
  drop down (if more than 2) inside the card** and places all suggested
  replies below; Rich card/Carousel suggestions are always placed first…
  Android separates Rich card/Carousel suggestions from message suggestions;
  all Rich card/Carousel suggestions are placed inside the card, while
  following message suggestions are displayed as a transient chip list below."
- [s18] Persistence: rich-card suggestions are persistent; message
  suggestions are flow-transient.

## Basic/rich text & hyperlinks

- [s5, s6] Basic text: max 160 chars (multi-byte emojis / double-byte
  languages reduce this). Rich text: up to 3072 chars; files max 100 MB.
- [s9] Hyperlinks: one per message, full `https://` URL, last element in the
  message, set `og:image` for a card-style preview; for rich cards prefer a
  suggested OpenURL action (gives postback data).
- [s10] iOS: a trailing hyperlink is replaced by a "Tap to Load Preview"
  tile; without `og:image` previews render as a tile, not a card.
- [s27] iOS: "if hyperlink is followed by text, link preview card is not
  rendered."

## Changelog notes

- [s44-46] Jan 2026: added detailed media dimensions/safe zones; documented
  rendering differences; mockups adopted iOS "Liquid Glass" design language.
