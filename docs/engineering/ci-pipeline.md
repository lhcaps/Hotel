# CI pipeline

CI runs on pushes to `main` and pull requests. The GitHub Actions PostgreSQL and Redis services must be healthy before steps run. CI performs frozen install, formatting, lint, typecheck, unit tests, build, static Drizzle history validation (`pnpm db:check`), guarded real PostgreSQL integration tests (`pnpm db:test`), explicit auth/catalog integration gates, focused pricing/availability/quote gates, OpenAPI drift validation, Storybook build, and the web axe suite before the Playwright smoke suite. The test URL is a loopback base for disposable `room_management_test_<uuid>` databases only; no seed command is run.

The remaining gates are Chromium Playwright smoke, an audit that fails on high/critical findings, and Gitleaks. Cache only pnpm store; build/test outputs are not trusted cache evidence. Obsolete runs are cancelled and Playwright reports upload only on failure. CI never deploys, seeds, or migrates a production/persistent environment.
