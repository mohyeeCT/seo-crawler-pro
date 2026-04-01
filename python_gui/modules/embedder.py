"""
embedder.py - Jina AI embeddings integration.
"""
import os, time, requests
from typing import Optional

JINA_API_URL = "https://api.jina.ai/v1/embeddings"
JINA_READER_URL = "https://r.jina.ai"
DEFAULT_MODEL = "jina-embeddings-v3"


def get_embeddings_batch(texts, api_key, model=DEFAULT_MODEL, task="retrieval.passage", batch_size=8, progress_callback=None):
    results = []
    total = len(texts)
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    for i in range(0, total, batch_size):
        batch = texts[i:i + batch_size]
        valid = [(j, t) for j, t in enumerate(batch) if t and t.strip()]
        if not valid:
            results.extend([None] * len(batch))
            continue
        payload = {"model": model, "task": task, "dimensions": 1024, "normalized": True, "embedding_type": "float", "input": [{"text": t[:8000]} for _, t in valid]}
        try:
            resp = requests.post(JINA_API_URL, json=payload, headers=headers, timeout=60)
            resp.raise_for_status()
            embeddings = [item["embedding"] for item in resp.json()["data"]]
            result_map = {orig_j: embeddings[idx] for idx, (orig_j, _) in enumerate(valid)}
            results.extend([result_map.get(j) for j in range(len(batch))])
        except Exception:
            results.extend([None] * len(batch))
        if progress_callback:
            progress_callback(min(i + batch_size, total), total)
        if i + batch_size < total:
            time.sleep(0.5)
    return results


def fetch_clean_text_jina_reader(url, api_key):
    try:
        resp = requests.get(f"{JINA_READER_URL}/{url}", headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json", "X-Return-Format": "markdown"}, timeout=30)
        resp.raise_for_status()
        return resp.json().get("data", {}).get("content", "")
    except Exception:
        return None


def embed_pages(pages, api_key, use_jina_reader=False, model=DEFAULT_MODEL, progress_callback=None):
    if use_jina_reader:
        texts = [fetch_clean_text_jina_reader(p["url"], api_key) or p.get("body_text", "") for p in pages]
    else:
        texts = [p.get("body_text", "") for p in pages]
    vectors = get_embeddings_batch(texts, api_key=api_key, model=model, progress_callback=progress_callback)
    for page, vector in zip(pages, vectors):
        page["embedding"] = vector
    return pages
