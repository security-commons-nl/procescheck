"""
Azure AD JWT authenticatie.
Valideert Bearer tokens via de Azure AD JWKS endpoint.
Als AZURE_TENANT_ID / AZURE_CLIENT_ID niet geconfigureerd zijn (dev-mode),
wordt authenticatie overgeslagen.
"""
import time
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.audit import current_user as current_user_var
from app.config import settings

_bearer = HTTPBearer(auto_error=False)
_jwks_cache: dict | None = None
_jwks_cached_at: float = 0.0
_JWKS_TTL = 86400  # 24 uur

# ── Rollen ────────────────────────────────────────────────────────────────────
# Azure AD app role values (Nederlands of Engels) → interne rol
_ROLE_MAP = {
    "lezer": "lezer", "reader": "lezer",
    "redacteur": "redacteur", "editor": "redacteur",
    "beheerder": "beheerder", "admin": "beheerder",
}
_ROLE_RANK = {"lezer": 0, "redacteur": 1, "beheerder": 2}


def _resolve_role(claim_roles: list[str] | None) -> str:
    """Hoogste bekende rol uit de roles-claim; zonder RBAC iedereen beheerder."""
    if not settings.rbac_enforced:
        return "beheerder"
    best = "lezer"  # onbekende of ontbrekende rol = alleen lezen
    for r in claim_roles or []:
        mapped = _ROLE_MAP.get(str(r).lower())
        if mapped and _ROLE_RANK[mapped] > _ROLE_RANK[best]:
            best = mapped
    return best


def _get_jwks(force: bool = False) -> dict:
    global _jwks_cache, _jwks_cached_at
    if force or _jwks_cache is None or (time.monotonic() - _jwks_cached_at) > _JWKS_TTL:
        url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/discovery/v2.0/keys"
        try:
            response = httpx.get(url, timeout=10)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            if _jwks_cache is not None:
                # Val terug op de (mogelijk verouderde) cache i.p.v. hard te falen
                return _jwks_cache
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure AD sleutels konden niet worden opgehaald",
            ) from exc
        _jwks_cache = response.json()
        _jwks_cached_at = time.monotonic()
    return _jwks_cache


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    Dependency die een geldig Azure AD Bearer token vereist.
    In dev-mode (geen Azure AD config) wordt een dummy user teruggegeven.

    Async zodat de ContextVar-set in de request-task zelf gebeurt en dus
    zichtbaar is voor de audit trail; een sync dependency draait in een
    threadpool met een gekopieerde context waardoor de set verloren gaat.
    """
    if not settings.auth_enabled:
        user = {"sub": "dev-user", "email": "dev@localhost", "name": "Dev user", "role": "beheerder"}
        current_user_var.set(user)
        return user

    if credentials is None:
        raise _unauthorized("Niet geauthenticeerd")

    token = credentials.credentials
    jwks = _get_jwks()

    # Bij key-rotatie in Azure AD staat de kid van het token nog niet in de
    # cache; ververs de JWKS dan één keer geforceerd.
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except JWTError as exc:
        raise _unauthorized(f"Token ongeldig: {exc}") from exc
    known_kids = {k.get("kid") for k in jwks.get("keys", [])}
    if kid and kid not in known_kids:
        jwks = _get_jwks(force=True)

    try:
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.azure_client_id,
            issuer=f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0",
        )
    except JWTError as exc:
        raise _unauthorized(f"Token ongeldig: {exc}") from exc

    user = {
        "sub": payload.get("sub"),
        "email": payload.get("preferred_username") or payload.get("email"),
        "name": payload.get("name"),
        "role": _resolve_role(payload.get("roles")),
    }
    current_user_var.set(user)
    return user


def _require_role(minimum: str):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "lezer")
        if _ROLE_RANK.get(role, 0) < _ROLE_RANK[minimum]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Onvoldoende rechten: rol '{minimum}' vereist",
            )
        return user
    return dependency


# Dependencies voor mutaties: redacteur mag aanmaken/wijzigen,
# beheerder mag ook verwijderen.
require_editor = _require_role("redacteur")
require_admin = _require_role("beheerder")
