from __future__ import annotations

from collections import Counter
from typing import Dict, Iterable, Optional

from flask import current_app

from CTFd.models import Challenges, Solves, Users, db


class Careers(db.Model):
    __tablename__ = "careers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(256), nullable=True)
    color = db.Column(db.String(32), nullable=True)

    steps = db.relationship(
        "CareerSteps",
        back_populates="career",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def to_dict(self, include_steps: bool = False, user_id: Optional[int] = None) -> Dict:
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
        }
        if include_steps:
            data["steps"] = [
                step.to_dict(user_id=user_id) for step in sorted(self.steps, key=lambda s: s.id)
            ]
        return data


class CareerSteps(db.Model):
    __tablename__ = "career_steps"
    __table_args__ = (
        db.UniqueConstraint("career_id", "name", name="uq_career_step_name"),
    )

    id = db.Column(db.Integer, primary_key=True)
    career_id = db.Column(
        db.Integer, db.ForeignKey("careers.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(128), nullable=True)
    required_solves = db.Column(db.Integer, nullable=False, default=1)

    career = db.relationship("Careers", back_populates="steps")
    progress_entries = db.relationship(
        "CareerUserProgress",
        back_populates="step",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def to_dict(self, user_id: Optional[int] = None) -> Dict:
        data = {
            "id": self.id,
            "career_id": self.career_id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "required_solves": self.required_solves,
        }
        if user_id is not None:
            progress = CareerUserProgress.query.filter_by(
                user_id=user_id, step_id=self.id
            ).first()
            data["completed"] = bool(progress.completed) if progress else False
        return data


class CareerUserProgress(db.Model):
    __tablename__ = "career_user_progress"
    __table_args__ = (
        db.UniqueConstraint("user_id", "step_id", name="uq_user_step"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    career_id = db.Column(
        db.Integer, db.ForeignKey("careers.id", ondelete="CASCADE"), nullable=False
    )
    step_id = db.Column(
        db.Integer, db.ForeignKey("career_steps.id", ondelete="CASCADE"), nullable=False
    )
    completed = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship("Users", backref="career_progress")
    career = db.relationship("Careers")
    step = db.relationship("CareerSteps", back_populates="progress_entries")

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "career_id": self.career_id,
            "step_id": self.step_id,
            "completed": self.completed,
        }


def _load_module_map(module_ids: Iterable[int]) -> Dict[int, str]:
    if not module_ids:
        return {}

    try:
        from CTFd.plugins.ctfd_modules.models import Modules  # type: ignore
    except Exception:  # pragma: no cover - optional dependency
        current_app.logger.debug("ctfd_modules not available for career mapping")
        return {}

    modules = Modules.query.filter(Modules.id.in_(set(module_ids))).all()
    mapping: Dict[int, str] = {}
    for module in modules:
        slug = getattr(module, "slug", None)
        mapping[module.id] = slug or getattr(module, "name", str(module.id))
    return mapping


def _collect_user_solves(user_id: int) -> Dict[str, Counter]:
    columns = [Challenges.category]
    module_column = None
    if hasattr(Challenges, "module_id"):
        module_column = getattr(Challenges, "module_id")
        columns.append(module_column)

    query = (
        db.session.query(Solves.challenge_id, *columns)
        .join(Challenges, Challenges.id == Solves.challenge_id)
        .filter(Solves.user_id == user_id)
    )
    results = query.all()

    category_counter: Counter = Counter()
    module_counter: Counter = Counter()
    module_ids = set()

    for solve in results:
        _, category, *module_values = solve
        if category:
            category_counter[category] += 1
        if module_column and module_values:
            module_id = module_values[0]
            if module_id:
                module_ids.add(module_id)
                module_counter[module_id] += 1

    module_map = _load_module_map(module_ids)
    resolved_module_counter: Counter = Counter()
    for module_id, count in module_counter.items():
        key = module_map.get(module_id)
        if key:
            resolved_module_counter[key] = count

    return {
        "categories": category_counter,
        "modules": resolved_module_counter,
        "total": Counter({"total": len(results)}),
    }


def update_progress(user_id: int) -> Dict[str, Dict]:
    """Recompute and persist the progress for a user across all careers."""
    user = Users.query.get(user_id)
    if not user:
        return {"user": None, "careers": []}

    solves = _collect_user_solves(user_id)
    category_counts = solves["categories"]
    module_counts = solves["modules"]

    progress_snapshot = []

    for career in Careers.query.all():
        career_progress = {"career_id": career.id, "steps": []}
        for step in career.steps:
            if step.category:
                solved = max(
                    category_counts.get(step.category, 0),
                    module_counts.get(step.category, 0),
                )
            else:
                solved = solves["total"].get("total", 0)

            completed = solved >= (step.required_solves or 0)

            progress_entry = CareerUserProgress.query.filter_by(
                user_id=user_id, step_id=step.id
            ).first()
            if not progress_entry:
                progress_entry = CareerUserProgress(
                    user_id=user_id,
                    career_id=career.id,
                    step_id=step.id,
                )
                db.session.add(progress_entry)

            progress_entry.completed = completed
            career_progress["steps"].append(
                {
                    "step_id": step.id,
                    "completed": completed,
                    "required_solves": step.required_solves,
                    "solved": solved,
                }
            )
        progress_snapshot.append(career_progress)

    db.session.commit()

    return {"user": user_id, "careers": progress_snapshot}
