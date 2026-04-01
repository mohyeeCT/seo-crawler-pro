"""
embedder.py - Jina AI embeddings with defensive API parsing + content-hash caching.
"""
import hashlib, json, time
from pathlib import Path
from typing import Optional
import requests

JINA_API_URL    = "https://api.jina.ai/v1/embeddings"
JINA_READER_URL = "https://r.jina.ai"
DEFAULT_MODEL   = "jina-embeddings-v3"
CACHE_FILE      = Path(".embedding_cache.json")

def _load_cache():
    if CACHE_FILE.exists():
        try: return json.loads(CACHE_FILE.read_text())
        except Exception: return {}
    return {}

def _save_cache(cache):
    try: CACHE_FILE.write_text(json.dumps(cache))
    except Exception: pass

def _cache_key(text, model):
    return hashlib.md5(f"{model}:{text}".encode()).hexdigest()

def _call_jina(texts, api_key, model, task):
    """Call Jina API with defensive schema parsing — no assumed response structure."""
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model, "task": task, "dimensions": 1024,
        "normalized": True, "embedding_type": "float",
        "input": [{"text": t[:8000]} for t in texts],
    }
    for attempt in range(2):
        try:
            resp = requests.post(JINA_API_URL, json=payload, headers=headers, timeout=60)
            if resp.status_code == 429:
                time.sleep(3)
                continue
            resp.raise_for_status()
            data = resp.json()

            # Defensive parse — handle multiple possible response shapes
            items = None
            if isinstance(data, dict):
                items = data.get("data") or data.get("embeddings") or data.get("results")
            if isinstance(data, list):
                items = data
            if not items:
                return [None] * len(texts)

            results = []
            for item in items:
                if isinstance(item, dict):
                    vec = item.get("embedding") or item.get("vector") or item.get("values")
                elif isinstance(item, list):
                    vec = item
                else:
                    vec = None
                results.append(vec if isinstance(vec, list) else None)

            while len(results) < len(texts):
                results.append(None)
            return results[:len(texts)]

        except requests.exceptions.RequestException:
            if attempt == 0:
                time.sleep(2)
    return [None] * len(texts)

def get_embeddings_batch(texts, api_key, model=DEFAULT_MODEL, task="retrieval.passage",
                         batch_size=8, use_cache=True, progress_callback=None):
    cache = _load_cache() if use_cache else {}
    results = [None] * len(texts)
    uncached = []

    for i, text in enumerate(texts):
        if not text or not text.strip():
            continue
        key = _cache_key(text, model)
        if use_cache and key in cache:
            results[i] = cache[key]
        else:
            uncached.append(i)

    total = len(uncached)
    done  = 0
    for batch_start in range(0, total, batch_size):
        batch_idx   = uncached[batch_start:batch_start + batch_size]
        batch_texts = [texts[i] for i in batch_idx]
        vectors     = _call_jina(batch_texts, api_key, model, task)

        for idx, vec in zip(batch_idx, vectors):
            results[idx] = vec
            if use_cache and vec is not None:
                cache[_cache_key(texts[idx], model)] = vec

        done += len(batch_idx)
        if progress_callback:
            progress_callback(done, total)
        if batch_start + batch_size < total:
            time.sleep(0.4)

    if use_cache:
        _save_cache(cache)
    return results

def fetch_clean_text_jina_reader(url, api_key):
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json", "X-Return-Format": "markdown"}
    try:
        resp = requests.get(f"{JINA_READER_URL}/{url}", headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict):
            return (data.get("data", {}).get("content")
                    or data.get("content") or data.get("markdown") or None)
        return None
    except Exception:
        return None

def embed_pages(pages, api_key, use_jina_reader=False, model=DEFAULT_MODEL,
                use_cache=True, progress_callback=None):
    if use_jina_reader:
        texts = [fetch_clean_text_jina_reader(p["url"], api_key) or p.get("body_text", "") for p in pages]
    else:
        texts = [p.get("body_text", "") for p in pages]

    vectors = get_embeddings_batch(texts, api_key=api_key, model=model,
                                   use_cache=use_cache, progress_callback=progress_callback)
    for page, vec in zip(pages, vectors):
        page["embedding"] = vec
    return pages
