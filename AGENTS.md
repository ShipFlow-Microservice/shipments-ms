# AGENTS.md

`shipments-ms` — NestJS 12 microservice (shipFlow project). Currently a bare starter: entrypoint `src/main.ts` (listens on `process.env.PORT ?? 3000`), empty `src/app.module.ts`, no controllers/providers yet. Git `main` has no commits yet; all branch conventions come from the spec workflow below.

## Commands

PowerShell on this machine blocks `npm.ps1` (execution policy). Use `npm.cmd` in shell commands:

```
npm.cmd run lint        # oxlint (NOT eslint) — config in oxlint.json
npm.cmd run test        # jest unit tests — *.spec.ts
npm.cmd run test:e2e    # jest e2e — test/*.e2e-spec.ts, config test/jest-e2e.json
npm.cmd run start:dev   # watch mode
npm.cmd run build       # nest build — doubles as the type check (no typecheck script)
```

- Single test: `npx jest src/path/file.spec.ts`, or `npx jest -t "test name"`.
- Format: `npm.cmd run format` (prettier: `singleQuote`, `trailingComma: "all"`).

## Known state (verified — not regressions)

- `npm test` exits 1 with "No tests found" — no `*.spec.ts` files exist yet.
- `npm run test:e2e` fails at compile time with TS5011: "The common source directory of 'tsconfig.json' is './test'. The 'rootDir' setting must be explicitly set" (TS 6 + `declaration: true` + ts-jest). Fixing it means setting an explicit `rootDir`; it is not app-code breakage.

## Config quirks

- Linter is **oxlint**, not ESLint — don't add ESLint configs. `@typescript-eslint/no-explicit-any` is intentionally off; `no-floating-promises` is warn.
- Path aliases live only in `tsconfig.json` `compilerOptions.paths` — `jest.config.ts` auto-maps them via `pathsToModuleNameMapper`. Never duplicate aliases in jest config. If adding a library with `nest g library`, register its alias in tsconfig and it just works.
- Unit vs e2e split by filename: `*.spec.ts` (jest.config.ts) vs `*.e2e-spec.ts` (test/jest-e2e.json).
- TS is strict but `strictPropertyInitialization` is off.

## Spec-driven workflow

This repo uses the `/spec` → `/spec-impl` skills (installed in `.agents/skills/`, pinned in `skills-lock.json`). Specs land in `specs/` (does not exist yet; first spec is `01-`).

- `/spec <one-sentence feature>` writes `specs/NN-slug.md` with state `Draft`. Only the human flips the state to `Approved` — never auto-approve.
- `/spec-impl NN-slug` validates the state is Approved, creates branch `spec-NN-slug`, then implements the plan step-by-step, pausing for diff review. It never commits automatically; commits are the user's decision.
- `specs/.spec-config.yml` controls automatic branch creation (`AutoCreateBranch: true` by default).
- Both skills reply in the user's language and read this file first as project memory — keep this file updated when conventions change.


## Project agents

- `spec-verify` — `.opencode/agents/spec-verify.md`, mode `all` (select it with Tab in the TUI, or launch it as a subagent from the main conversation). It closes the spec loop after `/spec-impl`: verifies the **Acceptance criteria** checklist of a spec against the real code, marks the checks, corrects non-boolean criterion wording, validates NestJS best practices via Context7, and flips the spec state to `Implemented` only when every criterion passes (never from `Draft`, never to `Approved`). It is read-only for app code — its edit permissions are limited to `specs/**` and its shell permissions to `npm.cmd run test|test:e2e|build|lint`, `npx jest`, and read-only git. It reports gaps with evidence; it never fixes them and never commits. Typical use: "use spec-verify on 01-slug".


## Context7
Utiliza siempre context7 para verificar y aplicar las mejores practicas de Nest.

## Specs

Todos los specs del proyecto deben guardarse en la carpeta `specs/` en la raíz del repositorio.

- Formato: Markdown (`.md`)
- Nomenclatura: `nombre-descriptivo.md` (kebab-case)
- Los specs deben incluir: objetivo, arquitectura, implementación detallada, y checklist de tareas
- Estado inicial: **PENDING APPROVAL** hasta que el usuario revise y apruebe
- Los specs sirven como documentación viva del diseño y decisiones técnicas