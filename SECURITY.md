# Security and Privacy Baseline

The public pilot intentionally avoids central processing of personal transcripts. Real institutional deployment must not enable server-side personal-data processing until the following are approved and evidenced:

1. Saudi-hosted data processing/storage architecture and processor due diligence.
2. Data-sharing agreement with the participating university.
3. Written retention/destruction policy and withdrawal workflow.
4. Role-based access control, MFA for privileged roles, immutable audit logs and least privilege.
5. DPIA/privacy assessment and incident-response process.
6. Security review before each release and accessibility verification.

Never commit credentials, student data, transcripts or production secrets to this repository.

## Reporting a vulnerability

Report privately through a [GitHub security advisory](https://github.com/adeebnoor/KAMIN/security/advisories/new) or the supervisor's public contact channels at https://adeebnoor.github.io/. The machine-readable contact is published at `/.well-known/security.txt` (RFC 9116). Do not attach transcripts, student identifiers or other personal data to a report; a description, the browser, the page and reproduction steps are enough. There is no bug bounty and no guaranteed response time in the public research release.
