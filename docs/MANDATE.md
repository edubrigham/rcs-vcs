# Mandate Coverage — CIO asks → what was delivered

How the CIO's three directives (and the production transfer) map to deliverables
and where each lives. The porting guide for the core dev team is
[`docs/PORTING.md`](PORTING.md).

| CIO ask | Delivered | Where |
|---|---|---|
| **Specs for API input + output**, based on the RCS Broadcast API (`rcsContentBody` is the input) | Input = `rcsContentBody` (mirrored 1:1, verified); output = the scoring I/O | `docs/rcs-broadcasts.yaml` (input source) · `docs/scoring-api.openapi.json` (I/O) · `types/rcs.ts` |
| **Fetch URL (images/videos) for size/dimensions** | `introspectMedia` (images: dims + size; video: type + size, header-only) + SSRF-guarded fetch, used internally by the scoring endpoints | `lib/media/introspect.ts` · `app/api/_lib/fetchMedia.ts` · `app/api/media-info/route.ts` |
| **Extra rules from the Google RBM rich-cards guide** | Canonical heights 112/168/264, vertical aspect set {2:1,16:9,7:3} nearest-of-set, supported-MIME list, file-size/animated-GIF checks (cited `RBM rich-cards`) | `lib/rcsRules.ts` · `lib/validateFunctional.ts` · `lib/scoreRcsContent.ts` |
| **Port-ready code for the transfer** | Pure kernel + golden vectors (parity) + the porting guide | `lib/` · `lib/__vectors__/` · `docs/PORTING.md` |

**Scoped deferrals (deliberate, agreed):** the `carouselRichCard` arm of
`rcsContentBody` is future work (Spec 2) — scoring covers `messageText` +
`standaloneRichCard`; video introspection is lightweight (type + size, no pixel
dimensions). **Phase 2** (AI-assistant content creation) is out of the current
mandate. The `app/` + `components/` SPA — including the `/api-playground` demo and
the `/api-docs` reference — is the disposable shell for CIO/stakeholder
confirmation; it is **not** ported.
