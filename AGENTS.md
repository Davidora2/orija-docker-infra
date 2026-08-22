# Agent instructions (Life OS / orija-docker-infra)

## Cloud agents and production

**Cloud agents must NEVER register accounts on production `https://lifeos.orija.store`.**

Automated signups with fake addresses (for example `audit-ui-*@example.com`, `dark-heroes-*@orija.store`, or other agent/test patterns) trigger SMTP verification emails. Those addresses do not exist, which causes bounce notifications for the operator.

- Use **local** or **test** environments only for automated registration, login, and UI walkthroughs.
- Do not exercise `/v1/auth/register` against production unless explicitly testing with a real personal email you control.
- Prefer mocked auth, integration tests with `TEST_DATABASE_URL`, or a dedicated staging stack.

The API blocks common agent/test email patterns at registration and refuses to send verification mail to blocked or unroutable domains.

### Optional dev-only email controls

| Variable | Effect |
|----------|--------|
| `SKIP_EMAIL_SEND=true` | Skip all outbound email (console log only). |
| `AUTH_EMAIL_VERIFICATION_DISABLED=true` | Skip auth verification/reset mail only; transactional mail still sends. |

Production should keep both unset so real users receive verification codes. Prefer the domain blocklist over disabling email globally.
