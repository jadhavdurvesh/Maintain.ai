"""
Optional online AI layer using Google's Gemini API.

AI is an enhancement, never a dependency: if GEMINI_API_KEY is missing, or the
call fails for any reason (no internet, quota, bad response), the caller
should fall back to offline_engine.diagnose(). This module never raises out
to the router — it returns None on failure so the caller can fall back.
"""
import json
import os
from typing import List, Optional

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")


def _resolve_api_key(db=None) -> Optional[str]:
    """Local DB setting (entered via the app's Settings page) wins over the
    .env var, so an installed app never needs its user to touch a text file."""
    if db is not None:
        from .. import settings_store
        stored = settings_store.get_setting(db, "gemini_api_key")
        if stored:
            return stored
    return os.getenv("GEMINI_API_KEY")

SYSTEM_INSTRUCTION = """You are the diagnostic assistant inside an industrial predictive-maintenance
system called MAINTAIN AI. A technician describes a machine problem. Respond ONLY with strict JSON
(no markdown fences, no commentary) matching exactly this shape:

{
  "safety_notice": "<one sentence safety reminder appropriate to the problem>",
  "needs_more_info": <true|false>,
  "clarifying_questions": ["<question>", ...],   // 2-5 questions if needs_more_info is true, else []
  "possible_causes": [
    {"cause": "<short cause name>", "confidence": <0-100 integer>, "certainty": "<confirmed|likely|possible|insufficient_information>"}
  ],
  "recommended_procedure": ["<step 1>", "<step 2>", ...]
}

Rules:
- Never state a cause as "confirmed" unless the technician's own words explicitly confirm it.
- If you don't have enough information, set needs_more_info true and leave possible_causes and
  recommended_procedure empty rather than guessing.
- Always start recommended_procedure with an isolation/lockout safety step when physical inspection
  is implied.
- Keep it concrete and specific to industrial machinery, not generic advice.
"""


def diagnose_with_gemini(
    problem_description: str,
    machine_context: Optional[dict] = None,
    answers: Optional[List[str]] = None,
    db=None,
) -> Optional[dict]:
    api_key = _resolve_api_key(db)
    if not api_key:
        return None

    try:
        import google.generativeai as genai
    except ImportError:
        # google-generativeai not installed -> silently fall back offline
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=SYSTEM_INSTRUCTION)

        context_lines = []
        if machine_context:
            context_lines.append(f"Machine: {machine_context}")
        if answers:
            context_lines.append("Technician's answers so far: " + "; ".join(answers))

        prompt = f"Problem reported: {problem_description}\n" + "\n".join(context_lines)

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )

        
        data = json.loads(response.text)
        data["source"] = "gemini"
        return data
    except Exception:
        # Any failure (network, quota, bad JSON, etc.) -> caller falls back to offline engine
        return None