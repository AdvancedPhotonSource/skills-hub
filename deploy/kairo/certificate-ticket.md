# InCommon certificate request: kairo.aps.anl.gov

Historical request: certificate issued November 4, 2026. The final deployment
uses **https://kairo.aps.anl.gov:8443**. The earlier request for administrator
setup on port 443 is no longer needed.

Please issue an InCommon TLS server certificate for the APS Skills Hub at
https://kairo.aps.anl.gov:8443. This host is replacing the current Arecibo deployment
and will be used for a new SSO integration.

Attach: **kairo.aps.anl.gov.csr**

CSR details:

- Common Name (CN): kairo.aps.anl.gov
- Subject Alternative Name (SAN): DNS:kairo.aps.anl.gov
- Location (L): Lemont
- Organizational Unit (OU): APS
- Public key: RSA, 3072 bits
- Request signature: SHA-256

The private key was generated on Kairo and remains there. Please return the
issued certificate and intermediate CA chain in PEM format.

The private key remains at
`/local/haskels/skills-hub/tls/kairo.aps.anl.gov.key` on Kairo.
