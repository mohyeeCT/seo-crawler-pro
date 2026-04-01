"""
analyzer.py
Cosine similarity, semantic duplicate detection, topical clustering,
and internal linking gap analysis using page embeddings.
"""

import numpy as np
from itertools import combinations
from typing import Optional


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a)
    b = np.array(vec_b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def build_similarity_matrix(pages: list[dict]) -> np.ndarray:
    n = len(pages)
    matrix = np.zeros((n, n))
    embedded = [(i, p["embedding"]) for i, p in enumerate(pages) if p.get("embedding")]
    for (i, vec_i), (j, vec_j) in combinations(embedded, 2):
        score = cosine_similarity(vec_i, vec_j)
        matrix[i][j] = score
        matrix[j][i] = score
    np.fill_diagonal(matrix, 1.0)
    return matrix


def find_semantic_duplicates(pages, matrix, threshold=0.92):
    duplicates = []
    n = len(pages)
    for i in range(n):
        for j in range(i + 1, n):
            score = matrix[i][j]
            if score >= threshold:
                duplicates.append({
                    "url_a": pages[i]["url"],
                    "url_b": pages[j]["url"],
                    "similarity": round(score, 4),
                    "title_a": pages[i].get("title", ""),
                    "title_b": pages[j].get("title", ""),
                    "recommendation": "Consolidate" if score >= 0.97 else "Review for canonical or redirect",
                })
    return sorted(duplicates, key=lambda x: x["similarity"], reverse=True)


def cluster_pages(pages, matrix, n_clusters=5):
    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import normalize
    except ImportError:
        return [{**p, "cluster": 0, "cluster_label": "Cluster 0"} for p in pages]

    embedded_indices = [i for i, p in enumerate(pages) if p.get("embedding")]
    if len(embedded_indices) < n_clusters:
        n_clusters = max(2, len(embedded_indices))

    vectors = np.array([pages[i]["embedding"] for i in embedded_indices])
    vectors = normalize(vectors)
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(vectors)

    label_map = {orig_i: int(labels[idx]) for idx, orig_i in enumerate(embedded_indices)}
    return [{**p, "cluster": label_map.get(i, -1), "cluster_label": f"Cluster {label_map.get(i, -1)}" if i in label_map else "Unembedded"} for i, p in enumerate(pages)]


def find_linking_gaps(pages, matrix, similarity_floor=0.75, top_n=3):
    gaps = []
    urls = [p["url"] for p in pages]
    for i, page in enumerate(pages):
        if not page.get("embedding"):
            continue
        linked = set()
        body = page.get("body_text", "").lower()
        for url in urls:
            path = url.split("//")[-1].split("/", 1)[-1] if "/" in url else ""
            if path and path in body:
                linked.add(url)
        similarities = [(j, matrix[i][j]) for j in range(len(pages)) if j != i and matrix[i][j] >= similarity_floor]
        similarities.sort(key=lambda x: x[1], reverse=True)
        opportunities = []
        for j, score in similarities[:top_n * 2]:
            if pages[j]["url"] not in linked:
                opportunities.append({"target_url": pages[j]["url"], "target_title": pages[j].get("title", ""), "similarity": round(score, 4)})
            if len(opportunities) >= top_n:
                break
        if opportunities:
            gaps.append({"source_url": page["url"], "source_title": page.get("title", ""), "linking_opportunities": opportunities})
    return gaps


def score_pages(pages):
    scored = []
    deductions = {"Missing title": 20, "Title too long": 5, "Title too short": 5, "Missing meta description": 15, "Meta description too long": 3, "Meta description too short": 3, "Missing H1": 15, "Multiple H1": 10, "Thin content": 10, "images missing alt": 5, "No canonical": 5, "noindexed": 20, "Crawl error": 30}
    for page in pages:
        score = 100
        for issue in page.get("issues", []):
            for key, deduction in deductions.items():
                if key.lower() in issue.lower():
                    score -= deduction
                    break
        scored.append({**page, "seo_score": max(0, score)})
    return scored


def run_full_analysis(pages, duplicate_threshold=0.92, linking_floor=0.75, n_clusters=5):
    pages = score_pages(pages)
    embedded_pages = [p for p in pages if p.get("embedding")]
    matrix = None
    duplicates = []
    clustered = pages
    linking_gaps = []

    if len(embedded_pages) >= 2:
        matrix = build_similarity_matrix(embedded_pages)
        duplicates = find_semantic_duplicates(embedded_pages, matrix, threshold=duplicate_threshold)
        clustered_embedded = cluster_pages(embedded_pages, matrix, n_clusters=n_clusters)
        cluster_map = {p["url"]: p for p in clustered_embedded}
        clustered = [{**p, **cluster_map.get(p["url"], {"cluster": -1, "cluster_label": "Unembedded"})} for p in pages]
        linking_gaps = find_linking_gaps(embedded_pages, matrix, similarity_floor=linking_floor)

    return {
        "pages": clustered,
        "similarity_matrix": matrix,
        "semantic_duplicates": duplicates,
        "linking_gaps": linking_gaps,
        "summary": {
            "total_pages": len(pages),
            "embedded_pages": len(embedded_pages),
            "duplicate_pairs": len(duplicates),
            "pages_with_issues": sum(1 for p in pages if p.get("issue_count", 0) > 0),
            "avg_seo_score": round(sum(p.get("seo_score", 0) for p in pages) / max(len(pages), 1), 1),
        },
    }
