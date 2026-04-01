"""
app.py - SEO Crawler — Streamlit Cloud ready
- nest_asyncio patches event loop before anything loads
- @st.cache_resource installs Playwright Chromium once per container startup
- Jina API key stays in sidebar for team use
"""
import sys, subprocess
from pathlib import Path

import nest_asyncio
nest_asyncio.apply()

import asyncio
import os
import pandas as pd
import streamlit as st

# ── Playwright one-time install (Streamlit Cloud only runs this once) ──────────
@st.cache_resource(show_spinner=False)
def _ensure_playwright():
    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            st.warning(f"Playwright install warning: {result.stderr[:200]}")
    except Exception as e:
        st.warning(f"Playwright install skipped: {e}")
    return True

_ensure_playwright()

sys.path.insert(0, str(Path(__file__).parent / "modules"))
from crawler import crawl_site
from embedder import embed_pages
from analyzer import run_full_analysis

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="SEO Crawler",
    page_icon="\U0001f577",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');
html, body, [class*="css"] { font-family: 'IBM Plex Sans', sans-serif; }
.main-header {
    background: #0f0f0f; color: #f0f0f0;
    padding: 1.5rem 2rem; border-radius: 4px;
    margin-bottom: 1.5rem; border-left: 4px solid #00d4aa;
}
.main-header h1 { margin: 0; font-size: 1.6rem; font-weight: 600; }
.main-header p  { margin: 0.25rem 0 0; color: #888; font-size: 0.85rem; }
.metric-card {
    background: #fafafa; border: 1px solid #e8e8e8;
    border-radius: 4px; padding: 1rem 1.2rem; text-align: center;
}
.metric-card .value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1.8rem; font-weight: 600; color: #0f0f0f;
}
.metric-card .label {
    font-size: 0.78rem; color: #666;
    text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;
}
.section-header {
    font-size: 0.7rem; text-transform: uppercase;
    letter-spacing: 1.5px; color: #888;
    border-bottom: 1px solid #e8e8e8;
    padding-bottom: 0.4rem; margin: 1.5rem 0 1rem;
}
</style>
""", unsafe_allow_html=True)

st.markdown(
    '''<div class="main-header">
    <h1>\U0001f577 SEO Crawler</h1>
    <p>JS rendering · Jina AI embeddings · Semantic duplicates · Linking gaps</p>
</div>''',
    unsafe_allow_html=True,
)

# ── Session state ─────────────────────────────────────────────────────────────
for key in ("results", "analysis"):
    if key not in st.session_state:
        st.session_state[key] = None

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### Crawl Settings")
    url_input = st.text_input("Start URL", placeholder="https://example.com")
    max_pages = st.slider("Max pages", 5, 500, 50, step=5)
    wait_strategy = st.selectbox(
        "JS wait strategy",
        ["networkidle", "domcontentloaded", "load"],
        help="networkidle waits for all network requests to finish. Slower but most accurate.",
    )
    timeout = st.slider("Page timeout (seconds)", 5, 60, 15)

    st.markdown("---")
    st.markdown("### Jina AI")
    st.caption("Get a free key at jina.ai — first 1M tokens free")
    jina_key = st.text_input(
        "Jina API key",
        type="password",
        placeholder="jina_...",
        help="Paste your Jina API key. Used for semantic embeddings only.",
    )
    use_embeddings = st.checkbox("Enable semantic analysis", value=True)
    use_reader = st.checkbox(
        "Use Jina Reader (cleaner text)",
        value=False,
        help="Fetches clean markdown before embedding. Better vectors, 2x API calls.",
    )

    st.markdown("---")
    st.markdown("### Analysis")
    dup_threshold = st.slider("Duplicate threshold", 0.80, 0.99, 0.92, step=0.01)
    n_clusters = st.slider("Topic clusters", 2, 15, 5)

    st.markdown("---")
    run_btn = st.button("Run Crawl", type="primary", use_container_width=True)

# ── Run ───────────────────────────────────────────────────────────────────────
if run_btn:
    if not url_input:
        st.error("Enter a URL to crawl.")
        st.stop()

    if use_embeddings and not jina_key:
        st.warning("No Jina key — crawling without embeddings.")
        use_embeddings = False

    st.session_state.results = None
    st.session_state.analysis = None

    # Crawl
    st.markdown('<div class="section-header">Crawling</div>', unsafe_allow_html=True)
    crawl_bar    = st.progress(0)
    crawl_status = st.empty()
    crawl_status.info(f"Starting crawl of {url_input}...")

    def on_crawl_progress(done, total, current_url):
        crawl_bar.progress(min(done / total, 1.0))
        crawl_status.info(f"Crawled {done}/{total} — {current_url}")

    try:
        loop  = asyncio.get_event_loop()
        pages = loop.run_until_complete(
            crawl_site(
                start_url=url_input,
                max_pages=max_pages,
                wait_until=wait_strategy,
                timeout_ms=timeout * 1000,
                progress_callback=on_crawl_progress,
            )
        )
        crawl_bar.progress(1.0)
        crawl_status.success(f"Done — {len(pages)} pages crawled")
    except Exception as e:
        crawl_status.error(f"Crawl failed: {e}")
        st.stop()

    # Embed
    if use_embeddings and jina_key and pages:
        st.markdown('<div class="section-header">Generating Embeddings</div>', unsafe_allow_html=True)
        embed_bar    = st.progress(0)
        embed_status = st.empty()
        pages_with_text = sum(1 for p in pages if p.get("body_text"))
        embed_status.info(f"Embedding {pages_with_text} pages via Jina AI...")

        def on_embed_progress(done, total):
            if total > 0:
                embed_bar.progress(min(done / total, 1.0))
                embed_status.info(f"Embedded {done}/{total} pages")

        try:
            pages = embed_pages(
                pages,
                api_key=jina_key,
                use_jina_reader=use_reader,
                progress_callback=on_embed_progress,
            )
            embed_bar.progress(1.0)
            embedded = sum(1 for p in pages if p.get("embedding"))
            embed_status.success(f"Done — {embedded}/{len(pages)} pages embedded")
        except Exception as e:
            embed_status.warning(f"Embedding failed: {e}. Continuing without semantic analysis.")

    analysis = run_full_analysis(pages, duplicate_threshold=dup_threshold, n_clusters=n_clusters)
    st.session_state.results  = pages
    st.session_state.analysis = analysis

# ── Results ───────────────────────────────────────────────────────────────────
if st.session_state.analysis:
    analysis = st.session_state.analysis
    pages    = st.session_state.results
    summary  = analysis["summary"]

    st.markdown('<div class="section-header">Summary</div>', unsafe_allow_html=True)
    c1, c2, c3, c4, c5 = st.columns(5)
    for col, (key, label) in zip(
        [c1, c2, c3, c4, c5],
        [
            ("total_pages",       "Pages crawled"),
            ("avg_seo_score",     "Avg SEO score"),
            ("pages_with_issues", "Pages with issues"),
            ("duplicate_pairs",   "Semantic duplicates"),
            ("embedded_pages",    "Pages embedded"),
        ],
    ):
        with col:
            st.markdown(
                f'<div class="metric-card">' +
                f'<div class="value">{summary[key]}</div>' +
                f'<div class="label">{label}</div></div>',
                unsafe_allow_html=True,
            )

    st.markdown("")
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "All Pages", "Issues", "Semantic Duplicates", "Linking Gaps", "Topical Clusters",
    ])

    with tab1:
        display_cols = [
            "url", "status_code", "title", "title_length", "meta_desc_length",
            "h1", "h1_count", "h2_count", "word_count", "images_missing_alt",
            "schema_types", "seo_score", "issue_count", "cluster_label",
        ]
        sample    = analysis["pages"][0] if analysis["pages"] else {}
        available = [c for c in display_cols if c in sample]
        df = pd.DataFrame(analysis["pages"])[available]

        def score_bg(val):
            if val >= 80: return "background-color: #d4edda"
            if val >= 60: return "background-color: #fff3cd"
            return "background-color: #f8d7da"

        st.dataframe(
            df.style.applymap(score_bg, subset=["seo_score"]),
            use_container_width=True, height=500,
        )
        st.download_button(
            "Download CSV", df.to_csv(index=False),
            file_name="seo_crawl.csv", mime="text/csv",
        )

    with tab2:
        issue_pages = [p for p in analysis["pages"] if p.get("issues")]
        if not issue_pages:
            st.success("No issues found.")
        else:
            issue_counts: dict = {}
            for p in issue_pages:
                for issue in p["issues"]:
                    k = issue.split("(")[0].strip()
                    issue_counts[k] = issue_counts.get(k, 0) + 1

            col_a, col_b = st.columns([1, 2])
            with col_a:
                st.markdown("**Issue frequency**")
                st.dataframe(
                    pd.DataFrame(
                        sorted(issue_counts.items(), key=lambda x: x[1], reverse=True),
                        columns=["Issue", "Count"],
                    ),
                    use_container_width=True, hide_index=True,
                )
            with col_b:
                st.markdown("**Pages by score**")
                rows = [
                    {"URL": p["url"], "Score": p.get("seo_score", 0), "Issues": " | ".join(p["issues"])}
                    for p in sorted(issue_pages, key=lambda x: x.get("seo_score", 0))
                ]
                st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    with tab3:
        dupes = analysis["semantic_duplicates"]
        if not dupes:
            st.info(f"No duplicates found at {dup_threshold} threshold.")
        else:
            st.caption(f"{len(dupes)} pairs above {dup_threshold} similarity")
            dupe_df = pd.DataFrame(dupes)[
                ["url_a", "url_b", "similarity", "recommendation", "title_a", "title_b"]
            ]
            st.dataframe(dupe_df, use_container_width=True, hide_index=True)
            st.download_button(
                "Download duplicates CSV", dupe_df.to_csv(index=False),
                file_name="semantic_duplicates.csv", mime="text/csv",
            )

    with tab4:
        gaps = analysis["linking_gaps"]
        if not gaps:
            st.info("No linking gaps found. Either embeddings were not generated or all similar pages are already linked.")
        else:
            st.caption(f"{len(gaps)} pages have internal linking opportunities")
            for gap in gaps[:50]:
                with st.expander(f"{gap['source_url']} — {len(gap['linking_opportunities'])} opportunities"):
                    for opp in gap["linking_opportunities"]:
                        label = opp["target_title"] or opp["target_url"]
                        st.markdown(
                            f"\u2192 [{label}]({opp['target_url']}) "
                            f"— similarity: `{opp['similarity']}`"
                        )

    with tab5:
        cluster_ids = sorted(set(p.get("cluster", -1) for p in analysis["pages"]))
        for cid in cluster_ids:
            cluster_list = [p for p in analysis["pages"] if p.get("cluster") == cid]
            label = f"Cluster {cid}" if cid >= 0 else "Unembedded"
            with st.expander(f"{label} — {len(cluster_list)} pages"):
                for cp in cluster_list:
                    score = cp.get("seo_score", 0)
                    bg    = "#d4edda" if score >= 80 else "#fff3cd" if score >= 60 else "#f8d7da"
                    st.markdown(
                        f'<span style="background:{bg};padding:2px 8px;border-radius:3px;' +
                        f'font-family:monospace;font-size:0.8rem">{score}</span> ' +
                        f'<a href="{cp["url"]}" target="_blank">{cp.get("title") or cp["url"]}</a>',
                        unsafe_allow_html=True,
                    )
