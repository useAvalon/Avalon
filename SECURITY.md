# Security

Report vulnerabilities **privately** through GitHub Security Advisories:

https://github.com/useAvalon/Avalon/security/advisories/new

Do not file a public issue or pull request that discloses an exploit, a proof of concept against a live site, or an unpatched bypass.

Include Avalon version (`@useavalon/avalon`), a clear impact statement, and steps to reproduce. Do not attach exploit payloads meant for third-party systems.

Avalon renders HTML on the server. Input that reaches markup must be escaped; see [AGENTS.md](./AGENTS.md).
