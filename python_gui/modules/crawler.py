"""
crawler.py - Playwright JS-rendering crawler.
"""
import asyncio, hashlib
from urllib.parse import urljoin, urlparse


async def crawl_site(start_url, max_pages=100, wait_until="networkidle", timeout_ms=15000, progress_callback=None):
    from playwright.async_api import async_playwright
    base = urlparse(start_url)
    base_origin = f"{base.scheme}://{base.netloc}"
    visited, queue, results = set(), [start_url], []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 (compatible; SEOCrawler/1.0)", viewport={"width": 1280, "height": 800})

        while queue and len(results) < max_pages:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            try:
                page = await context.new_page()
                response = await page.goto(url, wait_until=wait_until, timeout=timeout_ms)
                status = response.status if response else 0
                final_url = page.url
                title = await page.title()
                meta_desc = await page.evaluate('() => { const m = document.querySelector(''meta[name="description"]''); return m ? m.getAttribute("content") : ""; }')
                canonical = await page.evaluate('() => { const c = document.querySelector(''link[rel="canonical"]''); return c ? c.getAttribute("href") : ""; }')
                robots_meta = await page.evaluate('() => { const r = document.querySelector(''meta[name="robots"]''); return r ? r.getAttribute("content") : ""; }')
                h1s = await page.evaluate('() => Array.from(document.querySelectorAll("h1")).map(el => el.innerText.trim())')
                h2s = await page.evaluate('() => Array.from(document.querySelectorAll("h2")).map(el => el.innerText.trim())')
                h3s = await page.evaluate('() => Array.from(document.querySelectorAll("h3")).map(el => el.innerText.trim())')
                images_missing_alt = await page.evaluate('() => Array.from(document.querySelectorAll("img")).filter(img => !img.getAttribute("alt")).map(img => img.getAttribute("src") || "").filter(Boolean)')
                word_count = await page.evaluate('() => { const b = document.body ? document.body.innerText : ""; return b.split(/\\s+/).filter(w => w.length > 0).length; }')
                body_text = await page.evaluate('() => { const remove = ["nav","footer","header","script","style","noscript"]; const clone = document.body.cloneNode(true); remove.forEach(tag => { clone.querySelectorAll(tag).forEach(el => el.remove()); }); return clone.innerText.replace(/\\s+/g, " ").trim().slice(0, 3000); }')
                links = await page.evaluate(f'() => Array.from(document.querySelectorAll("a[href]")).map(a => a.href).filter(href => href.startsWith("{base_origin}"))')
                schema_types = await page.evaluate('() => Array.from(document.querySelectorAll(''script[type="application/ld+json"]'')). map(s => { try { const d = JSON.parse(s.textContent); return d[''@type''] || ""; } catch { return ""; }}).filter(Boolean)')
                og_title = await page.evaluate('() => { const m = document.querySelector(''meta[property="og:title"]''); return m ? m.getAttribute("content") : ""; }')
                og_desc = await page.evaluate('() => { const m = document.querySelector(''meta[property="og:description"]''); return m ? m.getAttribute("content") : ""; }')

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
                if images_missing_alt: issues.append(f"{len(images_missing_alt)} images missing alt text")
                if not canonical: issues.append("No canonical tag")
                if "noindex" in (robots_meta or "").lower(): issues.append("Page is noindexed")

                results.append({"url": final_url, "status_code": status, "title": title, "title_length": len(title), "meta_description": meta_desc, "meta_desc_length": len(meta_desc) if meta_desc else 0, "canonical": canonical, "robots_meta": robots_meta, "h1": h1s[0] if h1s else "", "h1_count": len(h1s), "h2s": " | ".join(h2s[:10]), "h2_count": len(h2s), "h3_count": len(h3s), "word_count": word_count, "images_missing_alt": len(images_missing_alt), "schema_types": ", ".join(schema_types), "og_title": og_title, "og_description": og_desc, "body_text": body_text, "content_hash": hashlib.md5(body_text.encode()).hexdigest(), "embedding": None, "issues": issues, "issue_count": len(issues)})

                for link in links:
                    clean = link.split("#")[0].split("?")[0]
                    if clean not in visited and clean not in queue:
                        queue.append(clean)
                if progress_callback:
                    progress_callback(len(results), max_pages, final_url)
                await page.close()
            except Exception as e:
                results.append({"url": url, "status_code": 0, "title": "", "title_length": 0, "meta_description": "", "meta_desc_length": 0, "canonical": "", "robots_meta": "", "h1": "", "h1_count": 0, "h2s": "", "h2_count": 0, "h3_count": 0, "word_count": 0, "images_missing_alt": 0, "schema_types": "", "og_title": "", "og_description": "", "body_text": "", "content_hash": "", "embedding": None, "issues": [f"Crawl error: {str(e)}"], "issue_count": 1})

        await browser.close()
    return results
