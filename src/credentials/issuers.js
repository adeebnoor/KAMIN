// Trusted issuer registry for the public release: intentionally empty.
// An entry is added only after a written agreement with the issuing institution and a key
// ceremony; until then every imported credential stays "unverified" regardless of its proof.
export const TRUSTED_ISSUER_REGISTRY_VERSION = 'kamin-trusted-issuers-v1'
export const trustedIssuers = Object.freeze([])
