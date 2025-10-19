from __future__ import annotations

from http import HTTPStatus
from typing import Any, Dict

from flask import jsonify, render_template, request
from werkzeug.exceptions import BadRequest

from CTFd.models import db
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


def register_routes(blueprint):
    @blueprint.route("/", methods=["GET"])
    @authed_only
    def player_dashboard():
        translations = load_translations()
        return render_template("progress.html", translations=translations)

    @blueprint.route("/admin", methods=["GET"])
    @admins_only
    def admin_dashboard():
        translations = load_translations()
        return render_template("admin.html", translations=translations)

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
        step = CareerSteps(
            career_id=career.id,
            name=payload["name"],
            description=payload.get("description"),
            category=payload.get("category"),
            required_solves=int(payload.get("required_solves", 1)),
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
