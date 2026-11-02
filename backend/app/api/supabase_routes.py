"""
FastAPI Router for Supabase Integration.
Provides endpoints for checking connection status, synchronizing scans to Supabase,
and persisting project code and data files into user-owned private databases.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel

from ..core.supabase import (
    SUPABASE_URL,
    SupabaseConfig,
    get_supabase_admin_client,
    get_supabase_user_client,
    get_current_user,
    normalize_url
)

router = APIRouter(prefix="/api/supabase", tags=["Supabase"])


class SyncScanPayload(BaseModel):
    project_name: str
    source_type: Optional[str] = "folder"
    source_url: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    diagrams: Optional[Dict[str, Any]] = None
    architecture_layers: Optional[Dict[str, Any]] = None
    high_coupling_modules: Optional[List[Dict[str, Any]]] = None
    circular_dependencies: Optional[List[List[str]]] = None
    files: Optional[List[Dict[str, Any]]] = None


class SyncFilesPayload(BaseModel):
    project_id: str
    files: List[Dict[str, Any]]


@router.get("/status")
def get_supabase_status():
    """
    Returns the Supabase server configuration status and connection health.
    """
    return {
        "status": "connected" if SupabaseConfig.is_configured() else "unconfigured",
        "url": SUPABASE_URL,
        "has_anon_key": bool(SupabaseConfig.anon_key),
        "has_service_role_key": SupabaseConfig.has_admin_access(),
        "database": "PostgreSQL with Row-Level Security (RLS)",
        "features": {
            "custom_user_database_supported": True,
            "high_scale_files": True,
            "data_files_support": True,
            "max_file_count": "unlimited",
            "storage_bucket": "project-files"
        }
    }


@router.post("/sync-scan")
def sync_project_scan(
    payload: SyncScanPayload,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Saves a scanned repository and its AST analysis into the user's private Supabase instance.
    Enforces Row-Level Security: the record is saved under the authenticated user's ID.
    """
    client = get_supabase_user_client(
        user["access_token"],
        custom_url=user.get("supabase_url"),
        custom_key=user.get("supabase_key")
    )
    user_id = user["id"]

    try:
        summary = payload.summary or {}
        project_res = client.table("projects").insert({
            "user_id": user_id,
            "name": payload.project_name,
            "source_type": payload.source_type or "folder",
            "source_url": payload.source_url,
            "loc": summary.get("total_loc", 0),
            "files_count": summary.get("total_files", 0),
            "data_files_count": summary.get("data_files_count", 0),
            "languages": summary.get("languages", {}),
        }).execute()

        if not project_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create project in user Supabase database."
            )

        project_id = project_res.data[0]["id"]

        scan_res = client.table("project_scans").insert({
            "project_id": project_id,
            "user_id": user_id,
            "summary": summary.get("overview", ""),
            "architecture_layers": payload.architecture_layers or {},
            "diagrams": payload.diagrams or {},
            "high_coupling_modules": payload.high_coupling_modules or [],
            "circular_dependencies": payload.circular_dependencies or [],
        }).execute()

        synced_files_count = 0
        if payload.files:
            synced_files_count = _batch_insert_project_files(client, project_id, user_id, payload.files)

        return {
            "success": True,
            "project_id": project_id,
            "scan_id": scan_res.data[0]["id"] if scan_res.data else None,
            "synced_files_count": synced_files_count,
            "target_database": user.get("supabase_url"),
            "message": f"Successfully synchronized '{payload.project_name}' and {synced_files_count} files to your private Supabase database."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database operation failed: {str(e)}"
        )


@router.post("/sync-project-files")
def sync_project_files(
    payload: SyncFilesPayload,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Bulk inserts project files (code and data files) into user's Supabase database in batches of 250.
    """
    client = get_supabase_user_client(
        user["access_token"],
        custom_url=user.get("supabase_url"),
        custom_key=user.get("supabase_key")
    )
    user_id = user["id"]

    try:
        inserted = _batch_insert_project_files(client, payload.project_id, user_id, payload.files)
        return {
            "success": True,
            "project_id": payload.project_id,
            "inserted_files_count": inserted
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk file sync failed: {str(e)}"
        )


def _batch_insert_project_files(client, project_id: str, user_id: str, raw_files: List[Dict[str, Any]]) -> int:
    batch_size = 250
    total_inserted = 0

    records_to_insert = []
    for f in raw_files:
        path = f.get("path") or f.get("name") or "unnamed"
        records_to_insert.append({
            "project_id": project_id,
            "user_id": user_id,
            "file_path": path,
            "file_name": f.get("name") or path.split("/")[-1],
            "extension": f.get("extension") or ("." + path.split(".")[-1] if "." in path else ""),
            "file_category": f.get("category") or ("data" if f.get("extension") in [".csv", ".tsv", ".json", ".sql", ".xml"] else "code"),
            "language": f.get("language") or "text",
            "size_bytes": f.get("size_bytes") or int(f.get("size_kb", 0) * 1024),
            "loc": f.get("loc", 0),
            "content": (f.get("content") or "")[:10000],
            "metadata": f.get("analysis", {}).get("metadata", {})
        })

    for i in range(0, len(records_to_insert), batch_size):
        chunk = records_to_insert[i:i + batch_size]
        res = client.table("project_files").insert(chunk).execute()
        if res.data:
            total_inserted += len(res.data)

    return total_inserted


@router.get("/projects")
def list_user_projects(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves all projects owned by the authenticated user from their private database.
    """
    client = get_supabase_user_client(
        user["access_token"],
        custom_url=user.get("supabase_url"),
        custom_key=user.get("supabase_key")
    )
    try:
        res = client.table("projects").select("*, project_scans(*)").order("created_at", desc=True).execute()
        return {"projects": res.data or []}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user projects: {str(e)}"
        )


@router.get("/projects/{project_id}/files")
def list_project_files(
    project_id: str,
    category: Optional[str] = Query(None),
    limit: int = Query(500, le=2000),
    offset: int = Query(0),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Paginates project files with optional category filter.
    """
    client = get_supabase_user_client(
        user["access_token"],
        custom_url=user.get("supabase_url"),
        custom_key=user.get("supabase_key")
    )
    try:
        query = client.table("project_files").select("*").eq("project_id", project_id)
        if category:
            query = query.eq("file_category", category)

        res = query.order("file_path", desc=False).range(offset, offset + limit - 1).execute()
        return {
            "project_id": project_id,
            "files": res.data or [],
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project files: {str(e)}"
        )
