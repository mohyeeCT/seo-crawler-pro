# seo-crawler-pro

A technical SEO crawler combining:

- **seo-reporter** (Node/TypeScript) — 220+ on-page checks, HTML report, CSV export, runs via CLI with no dependencies
- **Python GUI** (Streamlit) — JS rendering via Playwright, Jina AI semantic embeddings, duplicate detection, topical clustering, internal linking gap analysis

---

## Quick start — CLI (Node)

No install needed:

```bash
npx seo-reporter --url https://yoursite.com
```

With CSV export and deep crawl:

```bash
npx seo-reporter --url https://yoursite.com --depth 5 --max-pages 500 --export-csv
```

---

## Quick start — Streamlit GUI (Python)

```bash
cd python_gui
pip install -r requirements.txt
playwright install chromium
streamlit run app.py
```

---

## Repo structure

```
seo-crawler-pro/
├── dist/                   # seo-reporter compiled JS (CLI)
├── templates/              # seo-reporter HTML report templates
├── native/                 # seo-reporter Rust binaries
├── package.json            # Node package
├── CHANGELOG.md
└── python_gui/
    ├── app.py              # Streamlit GUI
    ├── requirements.txt
    └── modules/
        ├── crawler.py      # Playwright JS crawler
        ├── embedder.py     # Jina AI embeddings
        └── analyzer.py     # Cosine similarity, clustering, gaps
```

---

## CLI features (seo-reporter)

- 220+ technical SEO checks
- Rust-powered near-duplicate detection (MinHash)
- Worker thread parallelization
- HTML report + CSV export

## GUI features (Python)

- Full JS rendering via Playwright (Chromium)
- Jina AI embeddings (jina-embeddings-v3, 1024 dims)
- Semantic duplicate detection
- KMeans topical clustering
- Internal linking gap analysis
- SEO health score per page
- CSV export

---

## Jina AI

Get a free key at https://jina.ai — first 1M tokens free. Enter in the Streamlit sidebar.
