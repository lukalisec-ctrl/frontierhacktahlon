import json
import os
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)
MODEL = "llama-3.3-70b-versatile"


def _ask(prompt: str) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response.choices[0].message.content


def _parse_json(text: str):
    # Strip markdown code blocks if present
    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    return json.loads(text)


def generate_search_terms(profile: dict) -> list[str]:
    all_procedures = list({
        *profile.get("primary_procedures", []),
        *profile.get("secondary_procedures", []),
        *profile.get("learning_procedures", []),
        *profile.get("procedures", []),
    })
    all_techniques = list({
        *profile.get("approaches", []),
        *profile.get("techniques", []),
        *profile.get("devices", []),
    })
    study_types = profile.get("study_types", [])
    interests   = profile.get("clinical_interests", [])

    result = _ask(f"""You are a medical research librarian building PubMed search queries.

SURGEON PROFILE:
- Specialty: {profile.get("specialty", "")} {("/ " + profile.get("subspecialty","")) if profile.get("subspecialty") else ""}
- Procedures: {", ".join(all_procedures)}
- Techniques & devices: {", ".join(all_techniques)}
- Clinical interests: {", ".join(interests) if interests else "general outcomes"}
- Preferred study types: {", ".join(study_types) if study_types else "any"}
- Years in practice: {profile.get("experience_years", "")}

Generate 5 precise PubMed search queries targeting this surgeon's specific practice.

RULES:
- Do NOT include date filters (no [dp], no year ranges)
- Use MeSH terms and Boolean operators (AND, OR)
- Each query should target a different procedure or technique combination
- Bias toward the preferred study types if specified
- Return ONLY a raw JSON array of 5 strings, no markdown, no explanation""")
    return _parse_json(result)


def evaluate_paper(paper: dict, profile: dict) -> dict:
    abstract = paper.get("abstract", "").strip()
    if not abstract:
        return {"score": 0, "reason": "No abstract available.", "takeaway": "", "paper": paper}

    result = _ask(f"""You are a surgical evidence reviewer.
Is this paper relevant to this surgeon's practice?
Score relevance 1-10. Give 2 sentences: why relevant + key takeaway.
Return ONLY raw JSON with keys: score (int), reason (str), takeaway (str). No markdown.

Surgeon profile: {json.dumps(profile)}
Paper title: {paper.get("title", "")}
Abstract: {abstract[:1000]}""")
    parsed = _parse_json(result)
    parsed["paper"] = paper
    return parsed


def filter_papers(papers: list, profile: dict, min_score: int = 7) -> list:
    evaluated = [evaluate_paper(p, profile) for p in papers]
    relevant = [p for p in evaluated if p["score"] >= min_score]
    return sorted(relevant, key=lambda x: x["score"], reverse=True)
