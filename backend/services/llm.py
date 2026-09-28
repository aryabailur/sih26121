"""Optional LLM answer synthesis over retrieved evidence (production integration point).

Disabled by default. Enabled only when NWIS_DEMO_MODE=0 and NWIS_LLM_PROVIDER=anthropic,
with Anthropic credentials available (ANTHROPIC_API_KEY or an `ant auth login` profile)
and the optional `anthropic` package installed (see requirements-optional.txt).

The model sees ONLY the retrieved evidence and must cite it as [n]. Any failure —
missing SDK, no credentials, network error, refusal, or an answer without citations —
returns None and the caller keeps the deterministic extractive answer.
"""
from __future__ import annotations

import logging
import re

from config import LLM_MODEL

log = logging.getLogger("nwis.llm")

SYSTEM_PROMPT = """You are a drilling engineering knowledge assistant for Oil India Limited's NWIS system.
You MUST answer ONLY based on the provided evidence items, which are numbered [1], [2], ...
Cite every claim with the evidence number in square brackets, e.g. "Losses began at 1.52 sg ECD [1]."
If the evidence is insufficient, reply exactly: "Insufficient evidence in the knowledge base to answer this query with confidence."
Never fabricate drilling data, measurements, wells, depths or events.
Keep answers concise (3-5 sentences) and operationally actionable. The engineer makes the decision; you inform it."""


def _evidence_block(evidence: list[dict]) -> str:
    lines = []
    for i, e in enumerate(evidence, start=1):
        depth = ""
        if e.get("depth_start") is not None:
            depth = f"{e['depth_start']:,.0f}" + (f"–{e['depth_end']:,.0f}" if e.get("depth_end") not in (None, e["depth_start"]) else "") + " m"
        header = f"[{i}] {e.get('document_title')} | page {e.get('page') or 'n/a'} | well {e.get('well_name')} | depth {depth or 'n/a'}"
        lines.append(header + "\n" + (e.get("chunk_text") or "")[:1500])
    return "\n\n".join(lines)


def grounded_answer(query: str, evidence: list[dict]) -> str | None:
    if not evidence:
        return None
    try:
        import anthropic
    except ImportError:
        log.info("anthropic SDK not installed — using extractive answer")
        return None
    try:
        client = anthropic.Anthropic()
        response = client.with_options(timeout=30.0, max_retries=1).beta.messages.create(
            model=LLM_MODEL,
            max_tokens=8000,
            betas=["server-side-fallback-2026-06-01"],
            fallbacks=[{"model": "claude-opus-4-8"}],
            output_config={"effort": "low"},
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Evidence:\n\n{_evidence_block(evidence)}\n\nQuestion: {query}",
            }],
        )
    except anthropic.RateLimitError:
        log.warning("LLM rate limited — using extractive answer")
        return None
    except anthropic.APIStatusError as exc:
        log.warning("LLM API error %s — using extractive answer", exc.status_code)
        return None
    except anthropic.APIConnectionError:
        log.warning("LLM unreachable — using extractive answer")
        return None
    except Exception as exc:  # credentials missing, bad config, etc.
        log.warning("LLM unavailable (%s) — using extractive answer", exc)
        return None

    if response.stop_reason in ("refusal", "max_tokens"):
        return None
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    if not text or not re.search(r"\[\d+\]", text):
        return None  # ungrounded output is never shown
    cited = {int(n) for n in re.findall(r"\[(\d+)\]", text)}
    if any(n < 1 or n > len(evidence) for n in cited):
        return None
    return text
