"""
embedder.py - Jina AI embeddings with content-hash caching + exponential backoff.
"""
import time, json, os, requests
from typing import Optional

JINA_API_URL = "https://api.jina.ai/v1/embeddings"
JINA_READER_URL = "https://r.jina.ai"
DEFAULT_MODEL = "jina-embeddings-v3"
CACHE_FILE = os.path.join(os.path.dirname(__file__), ".embedding_cache.json")

def _load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f: return json.load(f)
        except: pass
    return {}

def _save_cache(cache):
    try:
        with open(CACHE_FILE, "w") as f: json.dump(cache, f)
    except: pass

def _post_with_retry(url, payload, headers, retries=3):
    delay = 1.0
    for attempt in range(retries):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=60)
            if resp.status_code == 429:
                time.sleep(delay); delay *= 2; continue
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            if attempt < retries - 1: time.sleep(delay); delay *= 2
            else: raise e
        except Exception:
            if attempt < retries - 1: time.sleep(delay); delay *= 2
            else: return None
    return None

def get_embeddings_batch(texts, api_key, model=DEFAULT_MODEL, task="retrieval.passage", batch_size=8, content_hashes=None, progress_callback=None):
    cache = _load_cache()
    results = [None] * len(texts)
    to_embed = []
    for i, text in enumerate(texts):
        h = content_hashes[i] if content_hashes else None
        if h and h in cache: results[i] = cache[h]
        elif text and text.strip(): to_embed.append((i, text))
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    total = len(to_embed)
    done = 0
    for batch_start in range(0, total, batch_size):
        batch = to_embed[batch_start:batch_start + batch_size]
        payload = {"model": model, "task": task, "dimensions": 1024, "normalized": True, "embedding_type": "float", "input": [{"text": t[:8000]} for _, t in batch]}
        data = _post_with_retry(JINA_API_URL, payload, headers)
        if data and "data" in data:
            for idx, item in enumerate(data["data"]):
                orig_i, _ = batch[idx]
                vector = item.get("embedding")
                if vector:
                    results[orig_i] = vector
                    h = content_hashes[orig_i] if content_hashes else None
                    if h: cache[h] = vector
        done += len(batch)
        if progress_callback: progress_callback(done, total)
        if batch_start + batch_size < total: time.sleep(0.4)
    _save_cache(cache)
    return results

def fetch_clean_text_jina_reader(url, api_key):
    try:
        resp = requests.get(f"{JINA_READER_URL}/{url}", headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json", "X-Return-Format": "markdown"}, timeout=30)
        resp.raise_for_status()
        return resp.json().get("data", {}).get("content", "")
    except: return None

def embed_pages(pages, api_key, use_jina_reader=False, model=DEFAULT_MODEL, progress_callback=None):
    texts = [fetch_clean_text_jina_reader(p["url"], api_key) or p.get("body_text", "") for p in pages] if use_jina_reader else [p.get("body_text", "") for p in pages]
    hashes = [p.get("content_hash") for p in pages]
    vectors = get_embeddings_batch(texts, api_key=api_key, model=model, content_hashes=hashes, progress_callback=progress_callback)
    for page, vector in zip(pages, vectors): page["embedding"] = vector
    return pages
