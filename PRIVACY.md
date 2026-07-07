# Privacy Policy — Founcode

*Last updated: July 7, 2026*

Founcode is a **local-first** desktop application. This policy is short because we designed the product so there is almost nothing to disclose.

## What we collect

**Nothing.** Founcode has no accounts, no sign-in, and no telemetry. We do not collect, store, or transmit your code, prompts, chat history, project names, usage statistics, or any personal information. All application data lives in a local SQLite database on your machine (`%APPDATA%\Founcode`).

## Network connections Founcode makes

Founcode connects to the internet in exactly three situations:

1. **Update checks** — the app contacts GitHub (github.com) to check for new releases. GitHub sees your IP address, governed by [GitHub's privacy statement](https://docs.github.com/privacy).
2. **License activation (Pro)** — when you activate a license key, the key and an instance name (derived from your computer name) are sent to Lemon Squeezy to validate the purchase, governed by [Lemon Squeezy's privacy policy](https://www.lemonsqueezy.com/privacy). Revalidation happens at most once per day.
3. **Nothing else.** The Free tier works fully offline, forever.

## Third-party AI agents

Founcode orchestrates AI agent CLIs that **you** install and log into (Claude Code, OpenCode, Codex, Antigravity, and others). When those agents run, **they** transmit your prompts and relevant code to their respective AI providers under **their** terms and privacy policies — exactly as they would if you ran them in a terminal yourself. Founcode never proxies, stores, or inspects that traffic, and never has access to your API keys or subscriptions.

## Payments

Purchases are processed entirely by Lemon Squeezy (our merchant of record). We never see your payment details.

## Contact

Questions: open an issue at [github.com/LittleScript/founcode-releases/issues](https://github.com/LittleScript/founcode-releases/issues).
