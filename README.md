# Artifact Gallery

Interactive tools and visualizations built with Claude. Vite-bundled, auto-deployed to GitHub Pages.

## Live Gallery

```
https://YOUR_USERNAME.github.io/artifact-gallery/
```

Each artifact has a direct shareable URL:

```
https://YOUR_USERNAME.github.io/artifact-gallery/artifacts/developer-toolkit-map/
```

## Structure

```
artifact-gallery/
├── index.html                              # Gallery page (lists all artifacts)
├── artifacts/                              # Vite-compiled artifacts
│   └── developer-toolkit-map/
│       ├── index.html                      # Entry point
│       └── app.jsx                         # React source (Vite compiles this)
├── public/originals/                        # Raw Claude artifact JSX (copied to dist as-is)
│   └── developer-toolkit-map.jsx
├── vite.config.js                          # Auto-discovers artifact entry points
├── package.json
└── .github/workflows/deploy.yml            # Auto-builds + deploys on push
```

## Adding a New Artifact

1. Create a folder: `artifacts/your-artifact-name/`
2. Add `index.html` (thin entry — copy from any existing artifact)
3. Add `app.jsx` (the component, with `createRoot` render call at bottom)
4. Save the original Claude JSX to `public/originals/your-artifact-name.jsx`
5. Add a card to the root `index.html` (template is commented in the file)
6. Push to `main` — GitHub Actions builds and deploys automatically

## Local Dev

```bash
npm install
npm run dev        # Dev server with hot reload
npm run build      # Production build to dist/
npm run preview    # Preview the production build
```

## Setup (One-Time)

1. Create this repo on GitHub (`gh repo create artifact-gallery --public --source=. --push`)
2. Go to **github.com → repo → Settings → Pages**
3. Source: **GitHub Actions** (not "deploy from branch")
4. Done — first push triggers the build
