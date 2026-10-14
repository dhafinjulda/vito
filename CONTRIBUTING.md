# Contributing

Use Node >=20.19 and pnpm 10.11.0. Run pnpm install --frozen-lockfile,
pnpm build, pnpm typecheck and pnpm test for verified changes. Examples run at
5173 (pnpm dev) and 5174 (pnpm dev:studio).

Read AGENTS.md and record decisions/evidence in IMPLEMENTATION_PLAN.md.
Core stays framework independent; generator is optional. Never upload or
commit personal camera frames, landmarks, poses or snapshots. Use synthetic
fixtures. Do not include API keys or private assets. Physical device acceptance
is separate from CI. npm publication requires the owner's explicit request.
