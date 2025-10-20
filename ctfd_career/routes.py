from __future__ import annotations

from http import HTTPStatus
from typing import Any, Dict, Optional

from flask import abort, jsonify, render_template, request
from werkzeug.exceptions import BadRequest

from CTFd.models import Challenges, Solves, db
from CTFd.utils.decorators import admins_only, authed_only
from CTFd.utils.user import get_current_user
from sqlalchemy.exc import IntegrityError

from .models import CareerSteps, Careers
from .services.progress import (
    ensure_user_entry,
    get_authenticated_progress,
    get_progress_snapshot,
    load_translations,
    serialize_progress_for_user,
)
from .services.sync import sync_all_users


class APIError(BadRequest):
    code = HTTPStatus.BAD_REQUEST

    def __init__(self, message: str) -> None:
        super().__init__(description=message)


def _validate_required_fields(data: Dict[str, Any], *fields: str) -> None:
    missing = [field for field in fields if not data.get(field)]
    if missing:
        raise APIError("Missing required fields: " + ", ".join(missing))


def _optional_int(value: Any) -> Optional[int]:
    if value in ("", None):
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise APIError("Invalid integer value") from exc


def register_routes(blueprint):
    @blueprint.route("/", methods=["GET"])
    @authed_only
    def player_dashboard():
        translations = load_translations()
        return render_template("progress.html", translations=translations)

    @blueprint.route("/<int:career_id>", methods=["GET"])
    @authed_only
    def career_detail(career_id: int):
        career = Careers.query.get_or_404(career_id)
        translations = load_translations()
        user = get_current_user()
        return render_template(
            "career_detail.html",
            translations=translations,
            career=career.to_dict(
                include_steps=True,
                user_id=(user.id if user else None),
            ),
        )

    @blueprint.route("/admin", methods=["GET"])
    @admins_only
    def admin_dashboard():
        translations = load_translations()
        return render_template("admin.html", translations=translations)

    @blueprint.route("/admin/steps", methods=["GET"])
    @admins_only
    def admin_steps():
        translations = load_translations()
        return render_template("admin_steps.html", translations=translations)

    @blueprint.route("/api/v1/career", methods=["GET"])
    @authed_only
    def list_careers():
        user = get_current_user()
        data = serialize_progress_for_user(user.id) if user else {"careers": []}
        return jsonify({"success": True, "data": data})

    @blueprint.route("/api/v1/career", methods=["POST"])
    @admins_only
    def create_career():
        payload = request.get_json() or {}
        _validate_required_fields(payload, "name")

        career = Careers(
            name=payload["name"],
            description=payload.get("description"),
            icon=payload.get("icon"),
            color=payload.get("color"),
        )

        db.session.add(career)
        try:
            db.session.commit()
        except IntegrityError as exc:
            db.session.rollback()
            raise APIError("Career already exists") from exc

        return (
            jsonify({"success": True, "data": career.to_dict()}),
            HTTPStatus.CREATED,
        )

    @blueprint.route("/api/v1/career/<int:career_id>", methods=["PUT"])
    @admins_only
    def update_career(career_id: int):
        payload = request.get_json() or {}
        career = Careers.query.get_or_404(career_id)

        for key in ["name", "description", "icon", "color"]:
            if key in payload:
                setattr(career, key, payload[key] or None)

        db.session.commit()
        return jsonify({"success": True, "data": career.to_dict()})

    @blueprint.route("/api/v1/career/<int:career_id>", methods=["DELETE"])
    @admins_only
    def delete_career(career_id: int):
        career = Careers.query.get_or_404(career_id)

        CareerSteps.query.filter_by(career_id=career.id).delete()
        db.session.delete(career)
        db.session.commit()

        return jsonify({"success": True, "data": {"deleted": career_id}})

    @blueprint.route("/api/v1/career/challenges", methods=["GET"])
    @admins_only
    def list_available_challenges():
        challenges = (
            Challenges.query.filter(Challenges.state == "visible")
            .order_by(Challenges.name.asc())
            .all()
        )
        data = [
            {
                "id": challenge.id,
                "name": challenge.name,
                "category": challenge.category,
                "value": challenge.value,
            }
            for challenge in challenges
        ]
        return jsonify({"success": True, "data": data})

    @blueprint.route("/api/v1/career/challenges/<int:challenge_id>", methods=["GET"])
    @authed_only
    def get_challenge(challenge_id: int):
        challenge = Challenges.query.get_or_404(challenge_id)
        user = get_current_user()

        if challenge.state != "visible" and (not user or getattr(user, "type", None) != "admin"):
            abort(404)

        solved = False
        if user:
            solved = (
                Solves.query.filter_by(user_id=user.id, challenge_id=challenge.id).first()
                is not None
            )

        meta = {
            "id": challenge.id,
            "name": challenge.name,
            "description": challenge.description,
            "value": challenge.value,
            "category": challenge.category,
            "type": challenge.type,
            "max_attempts": challenge.max_attempts,
            "state": challenge.state,
            "solved": solved,
        }

        try:
            rendered = render_template("challenges/challenge.html", challenge=challenge)
        except Exception:  # pragma: no cover - fallback if template missing
            rendered = None

        meta["html"] = rendered

        return jsonify({"success": True, "data": meta})

    @blueprint.route("/api/v1/career/steps/<int:career_id>", methods=["GET"])
    @authed_only
    def list_steps(career_id: int):
        user = get_current_user()
        ensure_user_entry(user.id)
        career = Careers.query.get_or_404(career_id)
        steps = [step.to_dict(user_id=user.id) for step in career.steps]
        return jsonify({"success": True, "data": steps})

    @blueprint.route("/api/v1/career/steps", methods=["POST"])
    @admins_only
    def create_step():
        payload = request.get_json() or {}
        _validate_required_fields(payload, "career_id", "name")

        career = Careers.query.get_or_404(payload["career_id"])
        challenge_id = _optional_int(payload.get("challenge_id"))
        required_solves = _optional_int(payload.get("required_solves", 1))
        if required_solves is None:
            required_solves = 1

        image_url = payload.get("image_url") or None

        step = CareerSteps(
            career_id=career.id,
            name=payload["name"],
            description=payload.get("description"),
            category=payload.get("category"),
            required_solves=required_solves,
            challenge_id=challenge_id,
            image_url=image_url,
        )

        db.session.add(step)
        try:
            db.session.commit()
        except IntegrityError as exc:
            db.session.rollback()
            raise APIError("Step already exists for this career") from exc

        return (
            jsonify({"success": True, "data": step.to_dict()}),
            HTTPStatus.CREATED,
        )

    @blueprint.route("/api/v1/career/steps/<int:step_id>", methods=["PUT"])
    @admins_only
    def update_step(step_id: int):
        payload = request.get_json() or {}
        step = CareerSteps.query.get_or_404(step_id)

        if "name" in payload:
            step.name = payload["name"] or step.name
        if "description" in payload:
            step.description = payload["description"] or None
        if "category" in payload:
            step.category = payload["category"] or None

        if "required_solves" in payload:
            required_value = _optional_int(payload.get("required_solves"))
            if required_value is not None:
                step.required_solves = required_value

        if "challenge_id" in payload:
            step.challenge_id = _optional_int(payload.get("challenge_id"))

        if "image_url" in payload:
            step.image_url = payload.get("image_url") or None

        try:
            db.session.commit()
        except IntegrityError as exc:
            db.session.rollback()
            raise APIError("Step already exists for this career") from exc

        return jsonify({"success": True, "data": step.to_dict()})

    @blueprint.route("/api/v1/career/steps/<int:step_id>", methods=["DELETE"])
    @admins_only
    def delete_step(step_id: int):
        step = CareerSteps.query.get_or_404(step_id)
        db.session.delete(step)
        db.session.commit()

        return jsonify({"success": True, "data": {"deleted": step_id}})

    @blueprint.route("/api/v1/career/progress", methods=["GET"])
    @authed_only
    def current_progress():
        data = get_authenticated_progress()
        return jsonify({"success": True, "data": data})

    @blueprint.route("/api/v1/career/sync", methods=["PUT"])
    @admins_only
    def sync_progress():
        snapshots = sync_all_users()
        return jsonify({"success": True, "data": snapshots})

    @blueprint.route("/api/v1/career/progress/<int:user_id>", methods=["GET"])
    @admins_only
    def admin_user_progress(user_id: int):
        data = ensure_user_entry(user_id)
        return jsonify({"success": True, "data": data})

    @blueprint.route("/api/v1/career/summary", methods=["GET"])
    @admins_only
    def summary():
        return jsonify({"success": True, "data": get_progress_snapshot()})

    @blueprint.errorhandler(APIError)
    def handle_api_error(error: APIError):  # pragma: no cover - handled by Flask
        response = jsonify({"success": False, "message": error.description})
        response.status_code = error.code
        return response
