"""
app.py - SEO Crawler Streamlit GUI
Fixes applied:
  1. nest_asyncio.apply() at startup — resolves asyncio.run() conflict with Streamlit
  2. Embedding cache toggle
  3. TSV export for direct Google Sheets paste
  4. Linking gaps flat CSV export
  5. Graceful degradation if any module fails
"""
import asyncio, sys
from pathlib import Path

# Fix 1: patch event loop before anything else
try:
    import nest_asyncio
    nest_asyncio.apply()
except ImportError:
    pass  # install via: pip install nest_asyncio

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent / "modules"))
from crawler import crawl_site
from embedder import embed_pages
from analyzer import run_full_analysis

st.set_page_config(page_title="SEO Crawler", page_icon="🕷", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');
html, body, [class*="css"] { font-family: 'IBM Plex Sans', sans-serif; }
.main-header { background:#0f0f0f;color:#f0f0f0;padding:1.5rem 2rem;border-radius:4px;margin-bottom:1.5rem;border-left:4px solid #00d4aa; }
.main-header h1 { margin:0;font-size:1.6rem;font-weight:600; }
.main-header p  { margin:0.25rem 0 0;color:#888;font-size:0.85rem; }
.metric-card { background:#fafafa;border:1px solid #e8e8e8;border-radius:4px;padding:1rem 1.2rem;text-align:center; }
.metric-card .value { font-family:'IBM Plex Mono',monospace;font-size:1.8rem;font-weight:600;color:#0f0f0f; }
.metric-card .label { font-size:0.78rem;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px; }
.section-header { font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;color:#888;border-bottom:1px solid #e8e8e8;padding-bottom:0.4rem;margin:1.5rem 0 1rem; }
</style>
""", unsafe_allow_html=True)

st.markdown('''<div class="main-header"><h1>🕷 SEO Crawler</h1><p>JS rendering · Jina AI embeddings · Semantic duplicate detection · Internal linking gaps</p></div>''', unsafe_allow_html=True)

for k in ("results", "analysis"):
    if k not in st.session_state: st.session_state[k] = None

with st.sidebar:
    st.markdown("### Crawl Settings")
    url_input     = st.text_input("Start URL", placeholder="https://example.com")
    max_pages     = st.slider("Max pages", 5, 500, 50, step=5)
    wait_strategy = st.selectbox("JS wait strategy", ["networkidle", "domcontentloaded", "load"])
    timeout_s     = st.slider("Page timeout (s)", 5, 60, 15)
    st.markdown("---")
    st.markdown("### Jina AI")
    jina_key       = st.text_input("Jina API key", type="password", placeholder="jina_...")
    use_embeddings = st.checkbox("Enable semantic analysis", value=True)
    use_reader     = st.checkbox("Jina Reader (cleaner text)", value=False)
    use_cache      = st.checkbox("Cache embeddings", value=True, help="Re-uses vectors for unchanged pages.")
    st.markdown("---")
    st.markdown("### Analysis")
    dup_threshold = st.slider("Duplicate threshold", 0.80, 0.99, 0.92, step=0.01)
    n_clusters    = st.slider("Topic clusters", 2, 15, 5)
    st.markdown("---")
    run_btn = st.button("Run Crawl", type="primary", use_container_width=True)

if run_btn:
    if not url_input:
        st.error("Enter a URL to crawl.")
        st.stop()
    if use_embeddings and not jina_key:
        st.warning("No Jina API key — running without embeddings.")
        use_embeddings = False
    st.session_state.results = st.session_state.analysis = None

    st.markdown('<div class="section-header">Crawling</div>', unsafe_allow_html=True)
    crawl_bar = st.progress(0)
    crawl_status = st.empty()
    crawl_status.info(f"Starting crawl of {url_input}...")

    def on_crawl(done, total, url):
        crawl_bar.progress(min(done / total, 1.0))
        crawl_status.info(f"Crawled {done}/{total} — {url}")

    try:
        pages = asyncio.run(crawl_site(start_url=url_input, max_pages=max_pages,
                            wait_until=wait_strategy, timeout_ms=timeout_s * 1000,
                            progress_callback=on_crawl))
        crawl_bar.progress(1.0)
        crawl_status.success(f"Crawl complete — {len(pages)} pages")
    except Exception as e:
        crawl_status.error(f"Crawl error: {e}")
        st.stop()

    if use_embeddings and jina_key and pages:
        st.markdown('<div class="section-header">Generating Embeddings</div>', unsafe_allow_html=True)
        embed_bar = st.progress(0)
        embed_status = st.empty()
        embed_status.info("Connecting to Jina AI...")

        def on_embed(done, total):
            embed_bar.progress(min(done / max(total, 1), 1.0))
            embed_status.info(f"Embedded {done}/{total} pages")

        try:
            pages = embed_pages(pages, api_key=jina_key, use_jina_reader=use_reader,
                                use_cache=use_cache, progress_callback=on_embed)
            embed_bar.progress(1.0)
            n = sum(1 for p in pages if p.get("embedding"))
            embed_status.success(f"Embeddings done — {n}/{len(pages)} pages")
        except Exception as e:
            embed_status.warning(f"Embedding failed: {e} — continuing without semantic analysis.")

    analysis = run_full_analysis(pages, duplicate_threshold=dup_threshold, n_clusters=n_clusters)
    st.session_state.results = pages
    st.session_state.analysis = analysis

if st.session_state.analysis:
    analysis = st.session_state.analysis
    pages    = st.session_state.results
    summary  = analysis["summary"]

    st.markdown('<div class="section-header">Summary</div>', unsafe_allow_html=True)
    cols = st.columns(5)
    for col, (k, label) in zip(cols, [("total_pages","Pages crawled"),("avg_seo_score","Avg SEO score"),("pages_with_issues","Pages with issues"),("duplicate_pairs","Semantic duplicates"),("embedded_pages","Pages embedded")]):
        with col:
            st.markdown(f'<div class="metric-card"><div class="value">{summary[k]}</div><div class="label">{label}</div></div>', unsafe_allow_html=True)
    st.markdown("")

    tab1, tab2, tab3, tab4, tab5 = st.tabs(["All Pages","Issues","Semantic Duplicates","Linking Gaps","Topical Clusters"])

    with tab1:
        cols_show = ["url","status_code","title","title_length","meta_desc_length","h1","h1_count","h2_count","word_count","images_missing_alt","schema_types","seo_score","issue_count","cluster_label"]
        first = analysis["pages"][0] if analysis["pages"] else {}
        avail = [c for c in cols_show if c in first]
        df = pd.DataFrame(analysis["pages"])[avail]
        def score_bg(v):
            if v >= 80: return "background-color:#d4edda"
            if v >= 60: return "background-color:#fff3cd"
            return "background-color:#f8d7da"
        styled = df.style.applymap(score_bg, subset=["seo_score"]) if "seo_score" in df.columns else df.style
        st.dataframe(styled, use_container_width=True, height=500)
        c1, c2 = st.columns(2)
        with c1: st.download_button("Download CSV", df.to_csv(index=False), "seo_crawl.csv", "text/csv")
        with c2: st.download_button("Download for Sheets (TSV)", df.to_csv(index=False, sep="\t"), "seo_crawl.tsv", "text/tab-separated-values")

    with tab2:
        issue_pages = [p for p in analysis["pages"] if p.get("issues")]
        if not issue_pages:
            st.success("No issues found.")
        else:
            counts = {}
            for p in issue_pages:
                for issue in p["issues"]:
                    k = issue.split("(")[0].strip()
                    counts[k] = counts.get(k, 0) + 1
            c1, c2 = st.columns([1,2])
            with c1:
                st.dataframe(pd.DataFrame(sorted(counts.items(), key=lambda x: x[1], reverse=True), columns=["Issue","Count"]), use_container_width=True, hide_index=True)
            with c2:
                idf = pd.DataFrame([{"URL":p["url"],"Score":p.get("seo_score",0),"Issues":" | ".join(p["issues"])} for p in sorted(issue_pages, key=lambda x: x.get("seo_score",0))])
                st.dataframe(idf, use_container_width=True, hide_index=True)
                st.download_button("Download issues CSV", idf.to_csv(index=False), "seo_issues.csv", "text/csv")

    with tab3:
        dupes = analysis["semantic_duplicates"]
        if not dupes:
            st.info(f"No semantic duplicates at {dup_threshold} threshold.")
        else:
            st.caption(f"{len(dupes)} pairs above {dup_threshold}")
            ddf = pd.DataFrame(dupes)[["url_a","url_b","similarity","recommendation","title_a","title_b"]]
            st.dataframe(ddf, use_container_width=True, hide_index=True)
            st.download_button("Download duplicates CSV", ddf.to_csv(index=False), "semantic_duplicates.csv", "text/csv")

    with tab4:
        gaps = analysis["linking_gaps"]
        if not gaps:
            st.info("No linking gaps found, or embeddings were not generated.")
        else:
            st.caption(f"{len(gaps)} pages have internal linking opportunities")
            gap_rows = [{"Source URL":g["source_url"],"Source Title":g["source_title"],"Target URL":o["target_url"],"Target Title":o["target_title"],"Similarity":o["similarity"]} for g in gaps for o in g["linking_opportunities"]]
            if gap_rows:
                st.download_button("Download linking gaps CSV", pd.DataFrame(gap_rows).to_csv(index=False), "linking_gaps.csv", "text/csv")
            for gap in gaps[:50]:
                with st.expander(f"{gap['source_url']} — {len(gap['linking_opportunities'])} opportunities"):
                    for o in gap["linking_opportunities"]:
                        st.markdown(f"→ [{o['target_title'] or o['target_url']}]({o['target_url']}) — similarity: `{o['similarity']}`")

    with tab5:
        cids = sorted(set(p.get("cluster",-1) for p in analysis["pages"]))
        for cid in cids:
            clist = [p for p in analysis["pages"] if p.get("cluster") == cid]
            with st.expander(f"Cluster {cid} — {len(clist)} pages" if cid >= 0 else f"Unembedded — {len(clist)} pages"):
                for cp in clist:
                    score = cp.get("seo_score", 0)
                    bg = "#d4edda" if score >= 80 else "#fff3cd" if score >= 60 else "#f8d7da"
                    st.markdown(f'<span style="background:{bg};padding:2px 8px;border-radius:3px;font-family:monospace;font-size:0.8rem">{score}</span> <a href="{cp["url"]}" target="_blank">{cp.get("title") or cp["url"]}</a>', unsafe_allow_html=True)
