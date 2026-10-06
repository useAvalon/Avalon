# Security

Report vulnerabilities **privately** — not as a public GitHub issue or pull request.

Use [GitHub Security Advisories](https://github.com/useAvalon/Avalon/security/advisories/new) so the report stays off the public issue tracker until there is a fix.

Do not disclose an exploit, a proof of concept against a live site, or an unpatched bypass in public.

Include:

- Package or area affected (e.g. `@useavalon/avalon` version, `www`, CI)
- Impact (who is affected, what an attacker can do)
- Steps to reproduce on a supported setup
- Suggested fix if you have one

Redact secrets, tokens, and customer data from reports.

We aim to acknowledge a private report within a week.

Avalon renders HTML on the server. Input that reaches markup must be escaped; see [AGENTS.md](./AGENTS.md).
