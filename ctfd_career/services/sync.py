from __future__ import annotations

from typing import Dict, List

from CTFd.models import Users

from ..models import update_progress


def sync_all_users() -> List[Dict]:
    """Recalculate progress for every user in the platform."""
    snapshots: List[Dict] = []
    for user in Users.query.with_entities(Users.id).all():
        result = update_progress(user.id)
        snapshots.append(result)
    return snapshots
