from dataclasses import dataclass
import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

ROLE_CLAIM_URI = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
logger = logging.getLogger(__name__)


@dataclass
class CurrentActor:
    user_id: str
    role: str
    token: str


bearer_scheme = HTTPBearer(auto_error=True)


def _extract_role(claims: dict) -> str:
    return (
        claims.get("role")
        or claims.get("Role")
        or claims.get(ROLE_CLAIM_URI)
        or ""
    )


def _normalize_token(raw_token: str) -> str:
    token = raw_token.strip()
    if token.lower().startswith("bearer "):
        return token[7:].strip()
    return token


def _allowed_algorithms(raw_value: str) -> list[str]:
    parsed = [item.strip().upper() for item in raw_value.split(",") if item.strip()]
    return parsed or ["HS512"]


def _token_alg(token: str) -> str:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        return "<unreadable>"
    return str(header.get("alg", "<missing>"))


def get_current_actor(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentActor:
    if not settings.jwt_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT key is not configured.",
        )

    token = _normalize_token(credentials.credentials)
    try:
        claims = jwt.decode(
            token,
            settings.jwt_key,
            algorithms=_allowed_algorithms(settings.jwt_allowed_algorithms),
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except jwt.InvalidTokenError as exc:
        logger.warning(
            "JWT validation failed: %s | token_alg=%s | allowed_algs=%s",
            exc,
            _token_alg(token),
            ",".join(_allowed_algorithms(settings.jwt_allowed_algorithms)),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        ) from exc

    user_id = str(claims.get("sub", "")).strip()
    role = str(_extract_role(claims)).strip()

    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain required claims.",
        )

    return CurrentActor(user_id=user_id, role=role, token=token)
