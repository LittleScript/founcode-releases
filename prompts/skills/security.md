# Founcode Skill: Security Review

Review this change as a defender: assume inputs are hostile, secrets leak, and users click everything.

## Checklist — walk it explicitly
1. **Inputs.** Every external input (HTTP params, files, env, IPC, CLI args) validated for type, length, and range at the boundary. Injection surfaces: SQL (parameterized only), shell (no string-built commands — argv arrays), path traversal (resolve + prefix check), HTML/JS (context-aware escaping, no dangerouslySetInnerHTML with user data).
2. **AuthN/AuthZ.** Who can call this? Every privileged path re-checks authorization server-side/main-side — never trust the client/renderer. Sessions/tokens: expiry, rotation, revocation.
3. **Secrets.** No keys/tokens/passwords in code, logs, error messages, or client bundles. Stored secrets encrypted at rest (OS keychain/DPAPI where available). `.env` in .gitignore — verify.
4. **Crypto.** Standard libraries only, no home-rolled primitives. Password hashing: argon2/bcrypt, never fast hashes. TLS for anything that leaves the machine.
5. **Failure behavior.** Errors fail CLOSED (deny) not open. Error messages to users reveal nothing internal; details go to logs.
6. **Dependencies.** New packages: maintained? typosquatting? install scripts? Lockfile committed.
7. **Data.** What personal data is touched? Is it minimized, and deletable?

## Deliver
Findings ranked Critical / High / Medium / Low, each with the exploit scenario in one sentence and the concrete fix. State clearly what you did NOT review.
