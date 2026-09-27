# Digital interests and student trust — 27 September 2026

## Shipped scope

Optional, browser-local keyword suggestions over student-selected text, in Arabic and English, for six technical/career topics. This is an experimental dictionary method, not a validated personality model or Cambridge Analytica implementation. No social-platform login, scraping, remote model, raw-post persistence or institutional sharing is added.

Students can try synthetic input without giving consent. Real text requires separate dated analysis consent. Every candidate must be confirmed or dismissed. Confirmed topics have a second, default-off permission for use in pathway explanations. Declining either purpose does not affect fit judgments, capability gaps or the ordering of pathways.

Only an allowlist survives persistence: topic ID, matching catalog terms, method version, confirmation time, source type, review status, notice version and purpose permissions. No account identifiers, arbitrary source text or sample records are retained. Selected text is cleared after analysis. Unknown text can contain personal information, so the interface explicitly asks students to remove names, identifiers and third-party or sensitive details before entry. A keyword matcher cannot certify that text contains no sensitive data.

## Graph contract

- Person `hasConfirmedInterest` Topic is a qualified claim with evidence, time, method and purpose.
- Evidence preserves only catalog keywords and review status, not the original post.
- Consent is an explicit local graph entity; its context permission is checked by matching.
- Reference pathways `relatesToTopic` Topic through a small authored catalog mapping.
- R4 joins the confirmed interest and reference topic edge into `hasInterestContextFor`.
- Deleting a topic, withdrawing the digital source, or withdrawing Person360 removes these paths on recomputation.
- This does not confer a skill or replace formal eligibility evidence.

## Storage and boundaries

Default session storage and opt-in IndexedDB are not encrypted by Kamin. Encrypted portable backups use AES-GCM. Technical JSON-LD downloads are unencrypted and explicitly labeled. Browser deletion cannot delete previously downloaded files. The host still receives normal asset requests and connection metadata.

Health records, violations, financial transactions, social-account personality inference, cross-student search, automatic decisions and central student-profile storage remain disabled. Future dimensions require a specific benefit and purpose; collecting everything for hypothetical future uses is not the product policy.

## Required institutional review before expansion

This engineering release is not a legal compliance certification. The accountable operator must work with Saudi privacy counsel / the university data protection function to establish controller/processor roles, a verified privacy contact, lawful bases and purpose notices, retention, access and deletion procedures, hosting/technical-log and transfer assessment, and applicable impact assessment requirements. Research involving students needs the institution's appropriate ethics review; participation must be voluntary and separated from grading and supervision decisions. A student's checkbox does not substitute for those duties.

Source: SDAIA, *Guide to the Saudi Personal Data Protection Law*, data-protection principles and subject rights:
https://dgp.sdaia.gov.sa/wps/wcm/connect/f579bc32-fda8-47bd-bc6f-66b8cb77985c/ENG-Guide%2Bto%2Bthe%2Bsaudi%2BPDP%2Blaw%2Bfor%2Bcontrollersprocessors.pdf?MOD=AJPERES

## Validation

Unit coverage checks consent/notice gates, Arabic normalization, token boundaries, allowlisted persistence, unchanged judgments, revocation, invalid provenance and standards-based RDF output. Browser coverage checks demo isolation, review, separate purpose permission, no raw text in state/requests, persistent deletion, English accessibility and mobile layout. Existing application checks remain required before merge.
