# Recipe Mix

Follow the C0–C8 sequence in README.md. Use the private playbook and `design-reference/` as local references when available. D00 establishes shared styling. D01 establishes the Recipe Box and responsive shell. Use real HTML controls, keyboard-visible focus and readable tap targets.

- Keep the project static with React, TypeScript, Vite, npm and hash routes. Production assets must resolve under `/recipe-mix-public/`. Use the pinned Node version and the npm lockfile.
- C0 uses temporary display fixtures. From C1 onward, put versioned IndexedDB and atomic writes behind a separate data layer. Use stable IDs, store base servings and ingredient quantities, and seed fresh databases once.
- Keep uncertain ingredient text and scale only known numeric quantities. Plan by local Monday–Sunday dates with one recipe per meal slot and servings saved on the slot.
- Grocery lists are weekly snapshots. Merge explicit aliases with the same normalized unit. Keep manual rows and preserve the state of unchanged generated rows on regeneration.
- Backup and restore include photos and use validated, atomic replacement. Offline caching, installation and the wake-lock fallback belong to their assigned milestones.
- Keep private references, backups, test photos, credentials, dependencies and generated files out of Git. Include only assets approved for distribution. Leave deployment for the release milestone and the user's publication decision.

Run lint, type checking, unit tests, production build and the browser smoke test when changing the application. Report the preview URL, checks, scope and review steps.
