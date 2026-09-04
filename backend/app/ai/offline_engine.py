"""
Offline Maintenance Intelligence engine.

This is the fallback that keeps MAINTAIN AI fully functional with no internet
connection and no AI API key, per the spec:

    USER PROBLEM -> Symptom Analyzer -> Local Knowledge Base ->
    Fault/Symptom Matching -> Diagnostic Questions -> Decision Tree ->
    Recommended Procedure

It never claims certainty it doesn't have: every cause is labelled
confirmed / likely / possible / insufficient_information.
"""
import json
import os
import sys
from typing import List, Optional

from sqlalchemy.orm import Session

from .. import models

if getattr(sys, "frozen", False):
    # Running as a PyInstaller-frozen binary: data files are extracted to
    # sys._MEIPASS at startup, matching the `datas` entry in the .spec file.
    _KB_PATH = os.path.join(sys._MEIPASS, "app", "ai", "knowledge_base.json")
else:
    _KB_PATH = os.path.join(os.path.dirname(__file__), "knowledge_base.json")

SAFETY_NOTICE = (
    "Before physical inspection, ensure the equipment is in a safe state and "
    "follow the approved isolation and safety procedures."
)

GENERIC_QUESTIONS = [
    "Is vibration also present?",
    "Is there any unusual smell (burning, ozone)?",
    "Did this start suddenly or develop gradually?",
    "Has the load or duty cycle increased recently?",
]


def _load_kb() -> list:
    with open(_KB_PATH) as f:
        return json.load(f)


def _certainty_label(confidence: int) -> str:
    if confidence >= 85:
        return "confirmed"
    if confidence >= 60:
        return "likely"
    if confidence >= 30:
        return "possible"
    return "insufficient_information"


def _score_entry(entry: dict, text: str, answers: List[str]) -> int:
    text = text.lower()
    combined_answers = " ".join(answers).lower() if answers else ""
    score = 0
    for symptom in entry.get("symptoms", []):
        s = symptom.lower()
        if s in text:
            score += 2
        if s in combined_answers:
            score += 3
    return score


def diagnose(
    db: Optional[Session],
    machine_category: Optional[str],
    problem_description: str,
    answers: Optional[List[str]] = None,
) -> dict:
    answers = answers or []
    kb = _load_kb()

    candidates = [e for e in kb if not machine_category or e["machine_category"] == machine_category]
    if not candidates:
        candidates = kb  # fall back to matching across all categories

    scored = sorted(candidates, key=lambda e: _score_entry(e, problem_description, answers), reverse=True)
    best = scored[0] if scored else None

    if not best or _score_entry(best, problem_description, answers) == 0:
        return {
            "safety_notice": SAFETY_NOTICE,
            "clarifying_questions": GENERIC_QUESTIONS,
            "possible_causes": [],
            "recommended_procedure": [],
            "source": "offline",
            "needs_more_info": True,
        }

    top_score = _score_entry(best, problem_description, answers)

    # Not enough signal yet -> ask this entry's clarifying questions before committing to causes.
    if top_score < 4 and len(answers) < len(best.get("questions", [])):
        unanswered = best.get("questions", [])[len(answers):]
        return {
            "safety_notice": SAFETY_NOTICE,
            "clarifying_questions": unanswered,
            "possible_causes": [],
            "recommended_procedure": [],
            "source": "offline",
            "needs_more_info": True,
        }

    causes = []
    for c in best.get("causes", []):
        confidence = c["confidence"]
        # Slightly boost confidence in the strongest matched cause when the
        # matched symptoms clearly point at it — kept conservative on purpose.
        causes.append({
            "cause": c["cause"],
            "confidence": confidence,
            "certainty": _certainty_label(confidence),
        })
    causes.sort(key=lambda c: c["confidence"], reverse=True)

    return {
        "safety_notice": SAFETY_NOTICE,
        "clarifying_questions": [],
        "possible_causes": causes,
        "recommended_procedure": best.get("recommended_procedure", []),
        "source": "offline",
        "needs_more_info": False,
    }
