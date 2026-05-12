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
from app.config import settings

_bearer = HTTPBearer(auto_error=False)
_jwks_cache: dict | None = None
_jwks_cached_at: float = 0.0
_JWKS_TTL = 86400  # 24 uur


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cached_at
    if _jwks_cache is None or (time.monotonic() - _jwks_cached_at) > _JWKS_TTL:
        url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/discovery/v2.0/keys"
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cached_at = time.monotonic()
    return _jwks_cache


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    Dependency die een geldig Azure AD Bearer token vereist.
    In dev-mode (geen Azure AD config) wordt een dummy user teruggegeven.
    """
    if not settings.auth_enabled:
        return {"sub": "dev-user", "email": "dev@localhost"}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Niet geauthenticeerd",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwks = _get_jwks()

    try:
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.azure_client_id,
            issuer=f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0",
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token ongeldig: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return {
        "sub": payload.get("sub"),
        "email": payload.get("preferred_username") or payload.get("email"),
        "name": payload.get("name"),
    }
