import requests
import xml.etree.ElementTree as ET
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
EMAIL = "surgintel@hackathon.com"
RECENT_DAYS = 7  # last 7 days by default


def _fetch_abstracts(pmids: list[str]) -> dict[str, str]:
    if not pmids:
        return {}
    resp = requests.get(f"{BASE_URL}/efetch.fcgi", params={
        "db": "pubmed",
        "id": ",".join(pmids),
        "rettype": "abstract",
        "retmode": "xml",
        "email": EMAIL,
    })
    abstracts = {}
    try:
        root = ET.fromstring(resp.content)
        for article in root.findall(".//PubmedArticle"):
            pmid = article.findtext(".//PMID")
            parts = article.findall(".//AbstractText")
            if parts:
                abstract = " ".join(
                    (f"{p.get('Label')}: {p.text}" if p.get('Label') else p.text or "")
                    for p in parts
                ).strip()
            else:
                abstract = ""
            abstracts[pmid] = abstract
    except ET.ParseError:
        pass
    return abstracts


def search_papers(search_terms: list[str], max_per_term: int = 3, recent_only: bool = True) -> list[dict]:
    papers = []
    seen_pmids = set()

    for term in search_terms:
        params = {
            "db": "pubmed",
            "term": term,
            "retmax": max_per_term,
            "retmode": "json",
            "sort": "date",
            "email": EMAIL,
        }
        if recent_only:
            params["reldate"] = RECENT_DAYS
            params["datetype"] = "pdat"

        search_resp = requests.get(f"{BASE_URL}/esearch.fcgi", params=params)
        pmids = search_resp.json().get("esearchresult", {}).get("idlist", [])
        new_pmids = [p for p in pmids if p not in seen_pmids]
        seen_pmids.update(new_pmids)

        if not new_pmids:
            continue

        summary_resp = requests.get(f"{BASE_URL}/esummary.fcgi", params={
            "db": "pubmed",
            "id": ",".join(new_pmids),
            "retmode": "json",
            "email": EMAIL,
        })
        result = summary_resp.json().get("result", {})
        abstracts = _fetch_abstracts(new_pmids)

        for pmid in new_pmids:
            article = result.get(pmid, {})
            if not article or "title" not in article:
                continue
            papers.append({
                "pmid": pmid,
                "title": article.get("title", ""),
                "authors": [a["name"] for a in article.get("authors", [])[:3]],
                "journal": article.get("source", ""),
                "pub_date": article.get("pubdate", ""),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "abstract": abstracts.get(pmid, ""),
                "search_term": term,
            })

    return papers
