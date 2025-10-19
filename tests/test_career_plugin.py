import datetime

import pytest

CTFd = pytest.importorskip("CTFd")

from CTFd import create_app  # noqa: E402
from CTFd.models import Challenges, Solves, Users, db  # noqa: E402
from CTFd.utils.security.auth import hash_password  # noqa: E402

from ctfd_career import load  # noqa: E402
from ctfd_career.models import CareerSteps, Careers, update_progress  # noqa: E402


@pytest.fixture(scope="module")
def app():
    app = create_app()
    app.config.update(
        SQLALCHEMY_DATABASE_URI="sqlite://",
        SECRET_KEY="testing-secret",
        TESTING=True,
        WTF_CSRF_ENABLED=False,
    )
    load(app)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def app_context(app):
    with app.app_context():
        yield


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
    )
    db.session.add(step)
    db.session.commit()

    stored_step = CareerSteps.query.filter_by(name="Recon").first()
    assert stored_step is not None
    assert stored_step.required_solves == 2


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
        value=challenge.value,
        date=datetime.datetime.utcnow(),
    )
    db.session.add(solve)
    db.session.commit()

    snapshot = update_progress(user.id)

    assert snapshot["careers"]
    assert snapshot["careers"][0]["steps"][0]["completed"] is True
