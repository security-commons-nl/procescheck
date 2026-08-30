"""
Automatische audit trail.

Registreert insert/update/delete op alle inhoudelijke entiteiten in de
audit_log-tabel, met veld-niveau wijzigingen en de ingelogde gebruiker.
De gebruiker komt uit een ContextVar die per request wordt gezet in
`get_current_user` (app/auth.py).
"""
from contextvars import ContextVar
from datetime import date, datetime

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Process, Application, BiaAssessment, RtoRpo, BusinessContext
from app.models.audit import AuditLog

current_user: ContextVar[dict | None] = ContextVar("current_user", default=None)

_AUDITED = (Process, Application, BiaAssessment, RtoRpo, BusinessContext)
# Techniekvelden die geen inhoudelijke wijziging zijn
_SKIP_FIELDS = {"created_at", "updated_at"}
_PENDING_KEY = "_pending_audit"


def _serialize(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _label(obj) -> str | None:
    code = getattr(obj, "code", None)
    name = getattr(obj, "name", None)
    if code and name:
        label = f"{code} – {name}"
    elif code or name:
        label = code or name
    else:
        # BIA/context/RTO-RPO: label van het bijbehorende proces
        proc = getattr(obj, "process", None)
        label = f"{proc.code} – {proc.name}" if proc is not None else None
    # Kap af op de kolomlengte (VARCHAR(255)); een lange naam mag nooit een
    # opslag blokkeren op de audit-log.
    if label is not None and len(label) > 255:
        label = label[:254] + "…"
    return label


def _process_id(obj) -> int | None:
    if isinstance(obj, Process):
        return obj.id
    return getattr(obj, "process_id", None)


def _column_changes(obj) -> dict:
    """Veld-niveau diff voor een gewijzigd object."""
    state = inspect(obj)
    changes: dict = {}
    for attr in state.mapper.column_attrs:
        if attr.key in _SKIP_FIELDS:
            continue
        hist = state.attrs[attr.key].history
        if not hist.has_changes():
            continue
        old = hist.deleted[0] if hist.deleted else None
        new = hist.added[0] if hist.added else None
        if old == new:
            continue
        changes[attr.key] = {"old": _serialize(old), "new": _serialize(new)}
    return changes


def _relationship_changes(obj) -> dict:
    """Wijzigingen in de proces↔applicatie-koppeling."""
    state = inspect(obj)
    changes: dict = {}
    for rel in ("applications",):
        if rel not in state.attrs:
            continue
        hist = state.attrs[rel].history
        if not hist.has_changes():
            continue
        added = [_label(o) or str(getattr(o, "id", "?")) for o in hist.added]
        removed = [_label(o) or str(getattr(o, "id", "?")) for o in hist.deleted]
        if added or removed:
            changes[rel] = {
                **({"added": added} if added else {}),
                **({"removed": removed} if removed else {}),
            }
    return changes


def _insert_snapshot(obj) -> dict:
    state = inspect(obj)
    changes: dict = {}
    for attr in state.mapper.column_attrs:
        if attr.key in _SKIP_FIELDS or attr.key == "id":
            continue
        value = getattr(obj, attr.key, None)
        if value not in (None, ""):
            changes[attr.key] = {"old": None, "new": _serialize(value)}
    return changes


@event.listens_for(SessionLocal, "before_flush")
def _collect_audit(session: Session, flush_context, instances) -> None:
    pending = session.info.setdefault(_PENDING_KEY, [])

    for obj in session.new:
        if isinstance(obj, _AUDITED):
            pending.append((obj, "insert", _insert_snapshot(obj)))

    for obj in session.dirty:
        if not isinstance(obj, _AUDITED):
            continue
        changes = {**_column_changes(obj), **_relationship_changes(obj)}
        if changes:  # geen no-op updates loggen (bv. autosave zonder wijziging)
            pending.append((obj, "update", changes))

    for obj in session.deleted:
        if isinstance(obj, _AUDITED):
            pending.append((obj, "delete", None))


@event.listens_for(SessionLocal, "after_flush")
def _write_audit(session: Session, flush_context) -> None:
    pending = session.info.pop(_PENDING_KEY, [])
    if not pending:
        return
    user = current_user.get() or {}
    rows = []
    for obj, action, changes in pending:
        rows.append({
            "entity_type": obj.__tablename__,
            "entity_id": getattr(obj, "id", None),
            "entity_label": _label(obj),
            "process_id": _process_id(obj),
            "action": action,
            "changes": changes,
            "user_email": user.get("email"),
            "user_name": user.get("name"),
        })
    session.connection().execute(AuditLog.__table__.insert(), rows)


@event.listens_for(SessionLocal, "after_rollback")
def _discard_audit(session: Session) -> None:
    session.info.pop(_PENDING_KEY, None)
