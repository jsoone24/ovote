# Security Policy

## Scope

ovote is a voting system. Bugs that affect **ballot integrity, ballot secrecy, voter anonymity, or eligibility enforcement** are treated as critical, regardless of surface (web, API, chaincode, deployment scripts, documentation that misrepresents guarantees).

## Reporting

Please report vulnerabilities privately. Do **not** open a public GitHub issue for security matters.

- Preferred channel: GitHub Private Vulnerability Reporting (once the repository is public).
- Alternate channel: email the maintainer listed in the repository metadata. Use a PGP key if publishing sensitive details.

## Response commitments

- Acknowledgement within 3 business days.
- Triage and initial assessment within 10 business days.
- Coordinated disclosure timeline agreed with the reporter; default 90 days or on fix publication, whichever is earlier.

## Out of scope

- Attacks that require a compromised voter device. ovote explicitly does not claim compromised-device resistance (see [ADR 0002](docs/adr/0002-security-properties.md)).
- Social engineering of voters into revealing ballot choices. No online system can prevent this.
- DoS that does not break secrecy, integrity, or eligibility.
- Vulnerabilities in dependencies without a demonstrated ovote exploit path (report those upstream first).

## Hall of fame

Acknowledged reporters will be listed here (with consent) once the first report is resolved.
