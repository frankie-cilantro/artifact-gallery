# CLAUDE.md — Artifact Gallery

Instructions for any Claude session (Cowork, Claude Code, etc.) working in this repo.

Owner: frankie (GitHub: `frankie-cilantro`)
Live site: https://frankie-cilantro.github.io/artifact-gallery/

## What this repo is

A personal gallery of interactive React/HTML artifacts built with Claude. Vite compiles JSX in CI; GitHub Actions auto-deploys to GitHub Pages on push to `main`. Frankie just commits files; he never touches Babel or build tooling directly.

## How to add a new artifact (the recipe)

When frankie says "add this to my gallery" / "save this artifact" / similar, do the following without asking unless something is genuinely ambiguous:

1. **Pick a slug.** Lowercase, hyphenated, descriptive: `pomodoro-timer`, `commodity-interlinkage-map`. Don't be cute; the slug is the URL.
2. **Create the artifact folder** at `artifacts/<slug>/` with two files:
   - `index.html` — thin entry. Copy from `artifacts/developer-toolkit-map/index.html` and only change the `<title>` and (optionally) the body background color.
   - `app.jsx` — the React component. Must end with a `createRoot(document.getElementById("root")).render(<App />)` call. Imports come from `react` and `react-dom/client`.
3. **Save the raw original JSX** to `public/originals/<slug>.jsx`. This is what the "JSX" link on the gallery card points to. It is NOT compiled; it's served as-is so people can read/copy the source. Usually identical to `app.jsx` minus the render call at the bottom (or identical, it's fine either way).
4. **Add a card** to the root `index.html`. Insert a `<div class="artifact-card">` block in the `.artifact-list` container, following the existing pattern. Newest artifacts go on top. Update the count at the bottom (`<div class="count">N artifacts</div>`).
5. **Commit and push.** Use a conventional commit message: `add <artifact name> artifact`. GitHub Actions handles the rest. Site updates in 30–60 seconds.

## Conventions

| Topic | Rule |
|---|---|
| Tag | Default to `tag-react` for React artifacts. If we ever add non-React, define a new tag class in `index.html` styles. |
| Imports in `app.jsx` | Only `react` and `react-dom/client` are guaranteed. If you need other npm packages, add them to `package.json` and re-run `npm install` before building. |
| External scripts | Avoid loading scripts/styles from CDNs in `app.jsx` — keep dependencies in `package.json` so the build is reproducible. Exception: Google Fonts via `<link>` in the artifact's `index.html`. |
| `localStorage` / `sessionStorage` | **Allowed here.** This is the user's own site, not the Claude.ai sandbox. Use freely for state persistence. |
| API keys / secrets | **Never** put a secret in this repo. The repo is public. If an artifact needs a backend, build that backend on Railway and call it from the artifact via fetch. |
| Styling | Match the gallery's aesthetic: DM Sans + DM Mono, dark mode, subtle. Each artifact can have its own internal style; the gallery card style is fixed. |
| Vite base path | Already set to `/artifact-gallery/` in `vite.config.js`. Don't change it unless the repo is renamed. |

## Workflow when frankie is in Cowork

- Cowork has this repo connected as a working folder.
- After file edits, run `git add .`, `git commit -m "..."`, `git push` from `mcp__workspace__bash` (mounted at `/sessions/<id>/mnt/artifact-gallery`).
- Don't run `npm run build` locally unless he asks — CI does it.
- Don't run `npm install` unless you've added a new dependency.
- If you add a new dependency, commit both `package.json` and `package-lock.json`.

## What NOT to do

- Don't create artifacts as raw single-file HTML if they're React — use the `app.jsx` + `index.html` pattern so Vite handles them.
- Don't add `dist/` to the repo — it's gitignored and built by CI.
- Don't push directly to GitHub Pages branches (`gh-pages`); the workflow uses GitHub Actions deployment, not branch deploys.
- Don't change the Vite config without checking with frankie — auto-discovery + base path are load-bearing.

## Useful commands

```bash
# Local preview (rare — usually not needed since CI deploys fast)
npm run dev          # http://localhost:5173/artifact-gallery/
npm run build        # produces dist/
npm run preview      # serves dist/ as it'll appear on Pages

# Deploy
git add . && git commit -m "add <artifact-name> artifact" && git push
```

## Adding a new tag/category later

If we ever need to filter or tag beyond "React," add a CSS class in `index.html` styles (`.tag-html`, `.tag-tool`, etc.) and use it on the card. We can add a search/filter UI to the gallery page once there are 10+ artifacts.
