# Kamin visual release — 30 September 2026

The design draws on the architectural imagery, dark navigation, large typography and clear sectional rhythm of the supplied Vision 2030 reference. Kamin keeps its own name, original content and independent visual assets; it does not imply government affiliation.

The hero is AI-generated conceptual artwork, not a photograph of a real campus or development. It was generated with the built-in image-generation tool from an original brief: sculptural limestone portals and paths toward a horizon, navy and teal atmosphere, warm sandstone, quiet space for HTML text, and no people, logos, copied landmarks or embedded lettering. It is decorative (`alt=""`); the actual headings and actions are accessible HTML.

Production assets are `public/images/kamin-horizon.webp` (88,002 bytes) and `public/images/kamin-horizon-mobile.webp` (23,500 bytes), optimized from the original 1659 × 948 PNG. No third-party reference image is shipped.

The public experience now separates the student, advisor and university entry points, presents the sample journey before asking for personal data, and keeps current product limits visible. Public document pages share the header, footer, type scale and spacing. The workspace retains its existing functions.

Browser review found and corrected two separate layout risks: the comparison table's intrinsic width and the opportunity cards' minimum grid width. Wide comparison content scrolls within a keyboard-focusable table region; cards adapt to the workspace width. Existing accessibility tests also caught an inherited dark research section whose heading needed an explicit light color under the new global typography.

Versioned visual references cover 44 public routes on desktop and mobile. The redesign-specific regression walks the sample journey in Arabic and English, selects three pathways and checks that the workspace has no horizontal overflow. The original unit, accessibility, browser and visual gates remain enabled.

This release does not add server accounts, a database or external AI processing. See `AI_NATIVE_PRODUCT_PLAN.md` for the student product delivery plan.
