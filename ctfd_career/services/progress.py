from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from flask import current_app
from flask_babel import get_locale

from CTFd.models import Users, db
from CTFd.utils.user import get_current_user

from ..models import CareerSteps, CareerUserProgress, Careers, update_progress


TRANSLATION_FALLBACK = "en"


def _get_locale_code() -> str:
    locale = get_locale()
    if locale is None:
        return TRANSLATION_FALLBACK
    return getattr(locale, "language", str(locale))


def load_translations() -> Dict[str, str]:
    base_path = Path(__file__).resolve().parent.parent / "translations"
    locale_code = _get_locale_code()
    translation_file = base_path / locale_code / "translations.json"
    if not translation_file.exists():
        translation_file = base_path / TRANSLATION_FALLBACK / "translations.json"

    try:
        with translation_file.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:  # pragma: no cover - fallback to avoid template crashes
        current_app.logger.warning(
            "Unable to load translations for locale '%s'", locale_code
        )
        return {}


def serialize_progress_for_user(user_id: int) -> Dict[str, List[Dict]]:
    update_progress(user_id)

    careers_data = []
    for career in Careers.query.order_by(Careers.id.asc()).all():
        steps = []
        for step in CareerSteps.query.filter_by(career_id=career.id).order_by(CareerSteps.id.asc()):
            progress = CareerUserProgress.query.filter_by(
                user_id=user_id, step_id=step.id
            ).first()
            steps.append(
                {
                    "id": step.id,
                    "name": step.name,
                    "description": step.description,
                    "category": step.category,
                    "required_solves": step.required_solves,
                    "completed": progress.completed if progress else False,
                }
            )

        careers_data.append(
            {
                "id": career.id,
                "name": career.name,
                "description": career.description,
                "icon": career.icon,
                "color": career.color,
                "steps": steps,
                "completed_steps": sum(1 for step in steps if step["completed"]),
                "total_steps": len(steps),
            }
        )

    return {"careers": careers_data}


def get_authenticated_progress() -> Dict[str, List[Dict]]:
    user = get_current_user()
    if not user:
        return {"careers": []}
    return serialize_progress_for_user(user.id)


def get_progress_snapshot() -> Dict[int, Dict[str, int]]:
    snapshot: Dict[int, Dict[str, int]] = {}
    for career in Careers.query.all():
        total_steps = len(career.steps)
        completed_steps = (
            CareerUserProgress.query.filter_by(career_id=career.id, completed=True)
            .with_entities(db.func.count())
            .scalar()
        )
        snapshot[career.id] = {
            "career": career.name,
            "completed": completed_steps,
            "total": total_steps,
        }
    return snapshot


def ensure_user_entry(user_id: int) -> Dict[str, List[Dict]]:
    Users.query.get_or_404(user_id)
    return serialize_progress_for_user(user_id)
