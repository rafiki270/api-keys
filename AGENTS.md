# Agent Notes (API Keys Library)

- First-party package; safe to modify for shared API-key functionality. Keep individual code files ≤500 lines.
- Maintain `CHANGELOG.md` for every update. Bump the package version (patch/minor as appropriate) and cut a GitHub release via `gh release create` when changes ship.
- Keep docs and usage examples current (`README.md`, `docs/`). Update types/exports together with code changes.
- Prefer reusable helpers; avoid duplicating logic already available in sibling libraries.
- Add or update tests/samples whenever behavior changes.
