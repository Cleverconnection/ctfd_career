import datetime

import pytest
from flask.testing import FlaskClient
from werkzeug.datastructures import Headers


CTFd = pytest.importorskip("CTFd")

from CTFd import create_app  # noqa: E402
from CTFd.utils import set_config  # noqa: E402
from CTFd.models import Challenges, Solves, Users, db  # noqa: E402
from CTFd.utils.security.signing import hmac as ctfd_hmac  # noqa: E402
try:  # pragma: no cover - compatibility with different CTFd versions
    from CTFd.utils.security.auth import hash_password  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover - fallback for older CTFd releases
    from CTFd.utils.crypto import hash_password  # type: ignore[attr-defined]



from ctfd_career import load  # noqa: E402
from ctfd_career.models import CareerSteps, Careers, update_progress  # noqa: E402


class CareerTestClient(FlaskClient):
    def open(self, *args, **kwargs):
        if kwargs.get("json") is not None:
            with self.session_transaction() as sess:
                csrf_headers = Headers({"CSRF-Token": sess.get("nonce")})
                headers = kwargs.pop("headers", Headers())
                if isinstance(headers, dict):
                    headers = Headers(headers)
                headers.extend(csrf_headers)
                kwargs["headers"] = headers
        return super().open(*args, **kwargs)


@pytest.fixture(scope="module")
def app():
    app = create_app()
    app.config.update(
        SQLALCHEMY_DATABASE_URI="sqlite://",
        SECRET_KEY="testing-secret",
        TESTING=True,
        WTF_CSRF_ENABLED=False,
    )
    app.config.setdefault("SESSION_COOKIE_NAME", "session")
    setattr(app, "session_cookie_name", app.config["SESSION_COOKIE_NAME"])
    app.test_client_class = CareerTestClient
    with app.app_context():
        load(app)

    with app.app_context():
        db.create_all()
        set_config("setup", True)
        yield app
        db.session.remove()
        try:
            db.drop_all()
        except Exception:  # pragma: no cover - cleanup best effort
            db.session.rollback()


@pytest.fixture()
def app_context(app):
    with app.app_context():
        yield


@pytest.fixture()
def admin_user(app_context):
    admin = Users(
        name="admin",
        email="admin@example.com",
        password=hash_password("password"),
        type="admin",
    )
    db.session.add(admin)
    db.session.commit()
    return admin


def test_career_creation(app_context):
    career = Careers(name="Blue Team", description="Cyber defense", color="#0047AB")
    db.session.add(career)
    db.session.commit()

    stored = Careers.query.filter_by(name="Blue Team").first()
    assert stored is not None
    assert stored.color == "#0047AB"


def test_step_creation(app_context):
    career = Careers(name="Security Path")
    db.session.add(career)
    db.session.commit()

    step = CareerSteps(
        career_id=career.id,
        name="Recon",
        description="Complete introductory recon challenges",
        category="Recon",
        required_solves=2,
        image_url="https://example.com/recon.png",
    )
    db.session.add(step)
    db.session.commit()

    stored_step = CareerSteps.query.filter_by(name="Recon").first()
    assert stored_step is not None
    assert stored_step.required_solves == 2
    assert stored_step.image_url == "https://example.com/recon.png"


def test_progress_updates_with_solves(app_context):
    user = Users(
        name="player1",
        email="player1@example.com",
        password=hash_password("password"),
    )
    db.session.add(user)
    db.session.commit()

    challenge = Challenges(
        name="Web 1",
        description="Simple web challenge",
        category="Web",
        value=100,
        state="visible",
        type="standard",
        max_attempts=0,
    )
    db.session.add(challenge)
    db.session.commit()

    career = Careers(name="Web Career")
    db.session.add(career)
    db.session.commit()

    step = CareerSteps(
        career_id=career.id,
        name="First Blood",
        category="Web",
        required_solves=1,
    )
    db.session.add(step)
    db.session.commit()

    solve = Solves(
        user_id=user.id,
        team_id=None,
        challenge_id=challenge.id,
        ip="127.0.0.1",
        provided="FLAG{test}",
        type="correct",
        date=datetime.datetime.utcnow(),
    )
    db.session.add(solve)
    db.session.commit()

    snapshot = update_progress(user.id)

    assert snapshot["careers"]
    career_entry = next(
        item for item in snapshot["careers"] if item["career_id"] == career.id
    )
    step_entry = next(
        item for item in career_entry["steps"] if item["step_id"] == step.id
    )
    assert step_entry["completed"] is True


def test_admin_manage_steps_with_challenge(app, app_context, admin_user):
    challenge_one = Challenges(
        name="API Challenge 1",
        description="First API challenge",
        category="Web",
        value=50,
        state="visible",
        type="standard",
        max_attempts=0,
    )
    challenge_two = Challenges(
        name="API Challenge 2",
        description="Second API challenge",
        category="Web",
        value=75,
        state="visible",
        type="standard",
        max_attempts=0,
    )
    career = Careers(name="API Career")
    db.session.add_all([challenge_one, challenge_two, career])
    db.session.commit()

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["id"] = admin_user.id
            sess["type"] = "admin"
            sess["nonce"] = "test-nonce"
            sess["hash"] = ctfd_hmac(admin_user.password)

        create_response = client.post(
            "/plugins/career/api/v1/career/steps",
            json={
                "career_id": career.id,
                "name": "API Step",
                "description": "Solve the initial API challenge",
                "required_solves": 1,
                "challenge_id": challenge_one.id,
                "image_url": "https://example.com/step.png",
            },
        )
        assert create_response.status_code == 201
        create_payload = create_response.get_json()
        assert create_payload["success"] is True
        step_id = create_payload["data"]["id"]
        assert create_payload["data"]["challenge_id"] == challenge_one.id
        assert create_payload["data"]["image_url"] == "https://example.com/step.png"

        update_response = client.put(
            f"/plugins/career/api/v1/career/steps/{step_id}",
            json={
                "name": "Updated API Step",
                "challenge_id": challenge_two.id,
                "required_solves": 1,
                "image_url": "https://example.com/updated.png",
            },
        )
        assert update_response.status_code == 200
        update_payload = update_response.get_json()
        assert update_payload["success"] is True
        assert update_payload["data"]["challenge_id"] == challenge_two.id
        assert update_payload["data"]["name"] == "Updated API Step"
        assert update_payload["data"]["image_url"] == "https://example.com/updated.png"

        delete_response = client.delete(
            f"/plugins/career/api/v1/career/steps/{step_id}", json={}
        )
        assert delete_response.status_code == 200
        delete_payload = delete_response.get_json()
        assert delete_payload["success"] is True
        assert delete_payload["data"]["deleted"] == step_id
        assert CareerSteps.query.get(step_id) is None


def test_update_progress_requires_challenge_solve(app_context):
    user = Users(
        name="challenge_player",
        email="challenge_player@example.com",
        password=hash_password("password"),
    )
    challenge = Challenges(
        name="Locked Challenge",
        description="Challenge tied to a career step",
        category="Forensics",
        value=100,
        state="visible",
        type="standard",
        max_attempts=0,
    )
    career = Careers(name="Challenge Career")
    db.session.add_all([user, challenge, career])
    db.session.commit()

    step = CareerSteps(
        career_id=career.id,
        name="Defeat the challenge",
        required_solves=1,
        challenge_id=challenge.id,
    )
    db.session.add(step)
    db.session.commit()

    snapshot_before = update_progress(user.id)
    career_entry_before = next(
        item for item in snapshot_before["careers"] if item["career_id"] == career.id
    )
    step_entry_before = next(
        item for item in career_entry_before["steps"] if item["step_id"] == step.id
    )
    assert step_entry_before["completed"] is False

    solve = Solves(
        user_id=user.id,
        team_id=None,
        challenge_id=challenge.id,
        ip="127.0.0.1",
        provided="FLAG{challenge}",
        type="correct",
        date=datetime.datetime.utcnow(),
    )
    db.session.add(solve)
    db.session.commit()

    snapshot_after = update_progress(user.id)
    career_entry_after = next(
        item for item in snapshot_after["careers"] if item["career_id"] == career.id
    )
    step_entry_after = next(
        item for item in career_entry_after["steps"] if item["step_id"] == step.id
    )
    assert step_entry_after["completed"] is True


def test_career_detail_page(app, app_context, admin_user):
    career = Careers(name="Detail Career", description="<strong>Shiny path</strong>")
    db.session.add(career)
    db.session.commit()

    step = CareerSteps(
        career_id=career.id,
        name="Detail Step",
        description="<em>Learn</em>",
        required_solves=0,
        image_url="https://example.com/detail.png",
    )
    db.session.add(step)
    db.session.commit()

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["id"] = admin_user.id
            sess["type"] = "admin"
            sess["nonce"] = "test-nonce"
            sess["hash"] = ctfd_hmac(admin_user.password)

        response = client.get(f"/plugins/career/{career.id}")
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        assert "Detail Career" in body
        assert "Detail Step" in body
        assert "test-nonce" not in body  # ensure no nonce leakage
