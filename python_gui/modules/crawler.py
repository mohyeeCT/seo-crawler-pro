"""
crawler.py - Playwright JS-rendering crawler.
Uses system chromium installed via packages.txt on Streamlit Cloud.
Falls back to Playwright bundled browser locally.
"""
import asyncio
import hashlib
import shutil
from urllib.parse import urlparse

_JS_META_DESC = """() => { const m = document.querySelector('meta[name="description"]'); return m ? m.getAttribute('content') : ''; }"""
_JS_CANONICAL = """() => { const c = document.querySelector('link[rel="canonical"]'); return c ? c.getAttribute('href') : ''; }"""
_JS_ROBOTS    = """() => { const r = document.querySelector('meta[name="robots"]'); return r ? r.getAttribute('content') : ''; }"""
_JS_H1S  = "() => Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim())"
_JS_H2S  = "() => Array.from(document.querySelectorAll('h2')).map(el => el.innerText.trim())"
_JS_H3S  = "() => Array.from(document.querySelectorAll('h3')).map(el => el.innerText.trim())"
_JS_WORD_COUNT = r"() => { const b = document.body ? document.body.innerText : ''; return b.split(/\s+/).filter(w => w.length > 0).length; }"
_JS_BODY_TEXT  = r"() => { const t = ['nav','footer','header','script','style','noscript']; const c = document.body.cloneNode(true); t.forEach(x => { c.querySelectorAll(x).forEach(e => e.remove()); }); return c.innerText.replace(/\s+/g, ' ').trim().slice(0,3000); }"
_JS_SCHEMA = """() => { return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => { try { const d = JSON.parse(s.textContent); return d['@type'] || ''; } catch(e) { return ''; } }).filter(Boolean); }"""
_JS_OG_TITLE = """() => { const m = document.querySelector('meta[property="og:title"]'); return m ? m.getAttribute('content') : ''; }"""
_JS_OG_DESC  = """() => { const m = document.querySelector('meta[property="og:description"]'); return m ? m.getAttribute('content') : ''; }"""
_JS_IMAGES_ALT = "() => Array.from(document.querySelectorAll('img')).filter(img => !img.getAttribute('alt')).map(img => img.getAttribute('src')||''). filter(Boolean)"

def _make_links_js(origin):
    return f"() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.startsWith('{origin}'))"

def _get_chromium_path():
    """Return system chromium path if available (Streamlit Cloud), else None (uses Playwright bundled)."""
    for candidate in ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"]:
        if shutil.which(candidate.split("/")[-1]) or __import__("os").path.exists(candidate):
            return candidate
    return None

async def crawl_site(start_url, max_pages=100, wait_until="load", timeout_ms=30000, js_hydration_wait=2000, progress_callback=None):
    from playwright.async_api import async_playwright

    base = urlparse(start_url)
    base_origin = f"{base.scheme}://{base.netloc}"
    links_js = _make_links_js(base_origin)
    chromium_path = _get_chromium_path()

    visited, queue, results = set(), [start_url], []

    launch_kwargs = {
        "headless": True,
        "args": [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-setuid-sandbox",
            "--single-process",
            "--disable-blink-features=AutomationControlled",
        ],
    }
    if chromium_path:
        launch_kwargs["executable_path"] = chromium_path

    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (compatible; SEOCrawler/1.0)",
            viewport={"width": 1280, "height": 800},
        )

        while queue and len(results) < max_pages:
            url = queue.pop(0)
            if url in visited: continue
            visited.add(url)
            try:
                page = await context.new_page()
                response = await page.goto(url, wait_until=wait_until, timeout=timeout_ms)
                # Wait for JS frameworks (React/Next.js/Vue) to hydrate the DOM.
                # 'load' fires before client-side JS runs, so we give it a moment.
                if js_hydration_wait > 0:
                    await page.wait_for_timeout(js_hydration_wait)
                status    = response.status if response else 0
                final_url = page.url

                title         = await page.title()
                meta_desc     = await page.evaluate(_JS_META_DESC)
                canonical     = await page.evaluate(_JS_CANONICAL)
                robots_meta   = await page.evaluate(_JS_ROBOTS)
                h1s           = await page.evaluate(_JS_H1S)
                h2s           = await page.evaluate(_JS_H2S)
                h3s           = await page.evaluate(_JS_H3S)
                images_no_alt = await page.evaluate(_JS_IMAGES_ALT)
                word_count    = await page.evaluate(_JS_WORD_COUNT)
                body_text     = await page.evaluate(_JS_BODY_TEXT)
                links         = await page.evaluate(links_js)
                schema_types  = await page.evaluate(_JS_SCHEMA)
                og_title      = await page.evaluate(_JS_OG_TITLE)
                og_desc       = await page.evaluate(_JS_OG_DESC)

                issues = []
                if not title: issues.append("Missing title tag")
                elif len(title) > 60: issues.append(f"Title too long ({len(title)} chars)")
                elif len(title) < 30: issues.append(f"Title too short ({len(title)} chars)")
                if not meta_desc: issues.append("Missing meta description")
                elif len(meta_desc) > 160: issues.append(f"Meta description too long ({len(meta_desc)} chars)")
                elif len(meta_desc) < 70: issues.append(f"Meta description too short ({len(meta_desc)} chars)")
                if len(h1s) == 0: issues.append("Missing H1")
                elif len(h1s) > 1: issues.append(f"Multiple H1 tags ({len(h1s)})")
                if word_count < 300: issues.append(f"Thin content ({word_count} words)")
                if images_no_alt: issues.append(f"{len(images_no_alt)} images missing alt text")
                if not canonical: issues.append("No canonical tag")
                if "noindex" in (robots_meta or "").lower(): issues.append("Page is noindexed")

                results.append({
                    "url": final_url, "status_code": status,
                    "title": title, "title_length": len(title),
                    "meta_description": meta_desc, "meta_desc_length": len(meta_desc) if meta_desc else 0,
                    "canonical": canonical, "robots_meta": robots_meta,
                    "h1": h1s[0] if h1s else "", "h1_count": len(h1s),
                    "h2s": " | ".join(h2s[:10]), "h2_count": len(h2s), "h3_count": len(h3s),
                    "word_count": word_count, "images_missing_alt": len(images_no_alt),
                    "schema_types": ", ".join(schema_types),
                    "og_title": og_title, "og_description": og_desc,
                    "body_text": body_text,
                    "content_hash": hashlib.md5(body_text.encode()).hexdigest(),
                    "embedding": None, "issues": issues, "issue_count": len(issues),
                })
                for link in links:
                    clean = link.split("#")[0].split("?")[0]
                    if clean not in visited and clean not in queue: queue.append(clean)
                if progress_callback: progress_callback(len(results), max_pages, final_url)
                await page.close()
            except Exception as e:
                results.append({"url": url, "status_code": 0, "title": "", "title_length": 0, "meta_description": "", "meta_desc_length": 0, "canonical": "", "robots_meta": "", "h1": "", "h1_count": 0, "h2s": "", "h2_count": 0, "h3_count": 0, "word_count": 0, "images_missing_alt": 0, "schema_types": "", "og_title": "", "og_description": "", "body_text": "", "content_hash": "", "embedding": None, "issues": [f"Crawl error: {str(e)}"], "issue_count": 1})
        await browser.close()
    return results
