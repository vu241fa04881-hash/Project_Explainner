"""
Supabase Client and Authentication Services for FastAPI.
Provides modular clients for:
1. Elevated Admin / Service Role operations
2. Authenticated user-scoped operations (enforcing RLS policies)
3. Dynamic multi-tenant support: allows users to provide their own personal Supabase URL
"""

import os
from typing import Optional, Dict, Any
from functools import lru_cache
from fastapi import HTTPException, Header, Depends, status
from pydantic import BaseModel
import supabase
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def normalize_url(raw_url: Optional[str]) -> str:
    if not raw_url:
        return ""
    clean = raw_url.strip()
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = "https://" + clean
    if clean.endswith("/rest/v1"):
        clean = clean[:-8]
    elif clean.endswith("/rest/v1/"):
        clean = clean[:-9]
    return clean.rstrip("/")


class SupabaseConfig:
    url: str = SUPABASE_URL
    anon_key: str = SUPABASE_ANON_KEY
    service_role_key: str = SUPABASE_SERVICE_ROLE_KEY

    @classmethod
    def is_configured(cls) -> bool:
        return bool(cls.url and (cls.service_role_key or cls.anon_key))

    @classmethod
    def has_admin_access(cls) -> bool:
        return bool(cls.url and cls.service_role_key and cls.service_role_key != "your_supabase_service_role_key_here")


# Singleton admin client
_admin_client_instance: Optional[Client] = None


def get_supabase_admin_client() -> Client:
    """
    Returns an elevated Supabase client initialized with the SERVICE_ROLE_KEY.
    """
    global _admin_client_instance
    if not SupabaseConfig.has_admin_access():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Service Role Key is not configured on the server."
        )

    if _admin_client_instance is None:
        _admin_client_instance = create_client(
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_SERVICE_ROLE_KEY
        )
    return _admin_client_instance


def get_supabase_user_client(
    access_token: str,
    custom_url: Optional[str] = None,
    custom_key: Optional[str] = None
) -> Client:
    """
    Returns a client scoped to the provided user's JWT access token and target Supabase URL.
    Supports user-provided personal Supabase instances.
    """
    target_url = normalize_url(custom_url) or SUPABASE_URL
    target_key = (custom_key or SUPABASE_ANON_KEY).strip()

    if not target_url or not target_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supabase URL and Anon Key are required."
        )

    client = create_client(
        supabase_url=target_url,
        supabase_key=target_key
    )
    # Inject user's bearer token into the client session
    client.postgrest.auth(access_token)
    return client


async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_supabase_url: Optional[str] = Header(None, alias="X-Supabase-Url"),
    x_supabase_key: Optional[str] = Header(None, alias="X-Supabase-Key")
) -> Dict[str, Any]:
    """
    FastAPI dependency that extracts and validates the Supabase Bearer token from the
    Authorization header. Dynamically validates against user's custom Supabase URL if provided.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected format: 'Bearer <token>'"
        )

    token = authorization.split("Bearer ")[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token provided."
        )

    target_url = normalize_url(x_supabase_url) or SUPABASE_URL
    target_key = (x_supabase_key or SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY).strip()

    if not target_url or not target_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supabase URL or Key not found to validate session."
        )

    # Validate token with Supabase Auth
    try:
        client = create_client(target_url, target_key)
        user_response = client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Supabase authentication session."
            )
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "user_metadata": user_response.user.user_metadata or {},
            "access_token": token,
            "supabase_url": target_url,
            "supabase_key": target_key
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Supabase token validation error: {str(e)}"
        )
