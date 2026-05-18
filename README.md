# Glow — Client

Glow is source-available for academic, research, educational, and other noncommercial use under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

Commercial use requires a separate written license from Purdue Research Foundation / Purdue University. Contact: ashok@learn-loop.org.

This repository contains the **Next.js client** — the user-facing UI for a Glow deployment. It is one of four components in the Glow platform:

| Component | What it is |
|---|---|
| [api](https://github.com/glow-academic/api) | FastAPI backend |
| **client** (this repo) | Next.js frontend |
| [cli](https://github.com/glow-academic/cli) | Rust CLI — the canonical deploy + management tool |
| [docs](https://github.com/glow-academic/docs) | Nextra docs site |

## Running a Glow deployment

End users do not run this repo directly. The supported install path is the CLI, which deploys the client alongside the api as a single blue/green stack:

```bash
brew tap glow-academic/tap
brew install glow
glow init
glow deploy
```

See the [docs](https://glow-academic.github.io/docs/) for the full deployment guide.

## Local development

```bash
bun install
bun run dev   # serves on http://localhost:3000
```

`AUTH_ISSUER`, `AUTH_CLIENT_ID`, `INTERNAL_API_BASE`, and `NEXT_PUBLIC_API_URL` are read from `.env.local`; defaults point at `http://localhost:8000` for a sibling api running locally.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

This is not an OSI-approved open-source license. It is intended to support academic and research dissemination while preserving separate commercial licensing rights.
