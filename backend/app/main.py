import os
import re
import shutil
import zipfile
import uuid
import subprocess
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .parser.repo_scanner import scan_repository
from .parser.graph_builder import DependencyGraphBuilder
from .visualizer.mermaid_builder import (
    build_dependency_mermaid,
    build_class_mermaid,
    build_architecture_layers_mermaid,
)
from .ai.explainer import explain_project, explain_file_code
from .ai.qa_engine import answer_repository_query
from .api.supabase_routes import router as supabase_router

app = FastAPI(
    title="Project Explainer API",
    description="Automated Codebase Summarization, Interactive Graph Visualizer, and AI Q&A",
    version="1.1.0"
)

# Include Supabase integration routes
app.include_router(supabase_router)


# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active session
CURRENT_SESSION: Dict[str, Any] = {
    "repo_data": None,
    "graph_data": None,
    "diagrams": None,
    "explanation": None,
}

# Base temporary directory for uploaded and cloned repositories
TEMP_ROOT = Path(__file__).resolve().parent.parent.parent / "temp_projects"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)

class ScanRequest(BaseModel):
    repo_path: str
    api_key: Optional[str] = None

class CloneRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    api_key: Optional[str] = None

class AskRequest(BaseModel):
    query: str
    api_key: Optional[str] = None
    active_file: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None

class CodeExplainRequest(BaseModel):
    file_path: Optional[str] = None
    code: Optional[str] = None
    mode: Optional[str] = "full"
    api_key: Optional[str] = None
    symbol_name: Optional[str] = None

class RestoreSessionRequest(BaseModel):
    repo_name: str
    repo_path: Optional[str] = "supabase://stored_project"
    total_files: int = 0
    total_loc: int = 0
    languages: Optional[Dict[str, Any]] = None
    files: Optional[Dict[str, Any]] = None
    tree: Optional[Dict[str, Any]] = None
    diagrams: Optional[Dict[str, Any]] = None
    explanation: Optional[Dict[str, Any]] = None
    symbol_name: Optional[str] = None


def _process_scanned_repo(repo_path: str, display_name: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
    p = Path(repo_path).resolve()
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail=f"Directory not found: {repo_path}")

    try:
        # 1. Scan repo and build AST
        repo_data = scan_repository(str(p))
        if display_name:
            repo_data["repo_name"] = display_name

        # 2. Build dependency graph
        graph_builder = DependencyGraphBuilder(repo_data)
        graph_data = graph_builder.build()

        # 3. Generate Mermaid diagrams
        dep_mermaid = build_dependency_mermaid(graph_data)
        arch_mermaid = build_architecture_layers_mermaid(repo_data)
        class_mermaid = build_class_mermaid(repo_data.get("files", {}))

        diagrams = {
            "dependency": dep_mermaid,
            "architecture": arch_mermaid,
            "classes": class_mermaid,
        }

        # 4. Generate AI or heuristic explanation
        explanation = explain_project(repo_data, api_key=api_key)

        # Store in session
        CURRENT_SESSION["repo_data"] = repo_data
        CURRENT_SESSION["graph_data"] = graph_data
        CURRENT_SESSION["diagrams"] = diagrams
        CURRENT_SESSION["explanation"] = explanation

        return {
            "status": "success",
            "repo_name": repo_data["repo_name"],
            "repo_path": repo_data["repo_path"],
            "total_files": repo_data["total_files"],
            "total_loc": repo_data["total_loc"],
            "languages": repo_data["languages"],
            "language_lines": repo_data["language_lines"],
            "tree": repo_data["tree"],
            "graph": graph_data,
            "diagrams": diagrams,
            "explanation": explanation,
            "files": repo_data.get("files", {})
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Project Explainer API", "version": "1.1.0"}


@app.post("/api/scan")
def scan_project(req: ScanRequest):
    target_path = req.repo_path.strip()
    if not target_path:
        raise HTTPException(status_code=400, detail="Repository path is required")
    return _process_scanned_repo(target_path, api_key=req.api_key)


@app.post("/api/clone")
def clone_and_scan_repo(req: CloneRequest):
    raw_url = req.repo_url.strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="Git repository URL is required")

    # Clean URL and determine project name
    clean_url = raw_url.rstrip("/")
    if clean_url.endswith(".git"):
        clean_url = clean_url[:-4]
    
    parts = clean_url.split("/")
    repo_name = parts[-1] if parts else "git_repo"
    safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', repo_name) or "repo"

    clone_base = TEMP_ROOT / "clones"
    clone_base.mkdir(parents=True, exist_ok=True)
    target_dir = clone_base / f"{safe_name}_{uuid.uuid4().hex[:8]}"

    git_success = False
    git_error_msg = ""

    # Attempt 1: Git CLI clone with --depth 1
    try:
        cmd = ["git", "clone", "--depth", "1"]
        if req.branch and req.branch.strip():
            cmd.extend(["-b", req.branch.strip()])
        cmd.extend([raw_url, str(target_dir)])

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode == 0 and target_dir.exists() and any(target_dir.iterdir()):
            git_success = True
        else:
            git_error_msg = result.stderr or result.stdout or "Git clone returned non-zero code"
    except Exception as e:
        git_error_msg = str(e)

    # Attempt 2: If Git failed or is unavailable, try downloading GitHub zip archive
    if not git_success:
        github_match = re.search(r'github\.com[/:]([^/]+)/([^/\.]+)', raw_url)
        if github_match:
            owner, repo = github_match.group(1), github_match.group(2)
            branches_to_try = [req.branch.strip()] if req.branch and req.branch.strip() else ["main", "master"]
            zip_downloaded = False

            for b in branches_to_try:
                zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{b}.zip"
                try:
                    target_dir.mkdir(parents=True, exist_ok=True)
                    temp_zip = target_dir / "download.zip"
                    
                    req_obj = urllib.request.Request(
                        zip_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                    )
                    with urllib.request.urlopen(req_obj, timeout=60) as resp, open(temp_zip, "wb") as out_f:
                        shutil.copyfileobj(resp, out_f)

                    # Extract zip
                    extract_dir = target_dir / "extracted"
                    extract_dir.mkdir(parents=True, exist_ok=True)
                    with zipfile.ZipFile(temp_zip, 'r') as zf:
                        zf.extractall(extract_dir)

                    # Check inner folder
                    inner_items = [p for p in extract_dir.iterdir() if p.name not in ("__MACOSX", ".DS_Store")]
                    scan_dir = extract_dir
                    if len(inner_items) == 1 and inner_items[0].is_dir():
                        scan_dir = inner_items[0]

                    git_success = True
                    target_dir = scan_dir
                    zip_downloaded = True
                    break
                except Exception:
                    continue

            if not zip_downloaded:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to clone or download repository: {git_error_msg}"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Git clone failed: {git_error_msg}. Please check repository URL and permissions."
            )

    return _process_scanned_repo(str(target_dir), display_name=repo_name, api_key=req.api_key)


@app.post("/api/upload-folder")
async def upload_folder_project(
    files: List[UploadFile] = File(...),
    paths: Optional[List[str]] = Form(None),
    api_key: Optional[str] = Form(None)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files received in upload")

    temp_base = TEMP_ROOT / "uploads"
    temp_base.mkdir(parents=True, exist_ok=True)
    upload_id = uuid.uuid4().hex[:8]
    target_dir = temp_base / f"folder_{upload_id}"
    target_dir.mkdir(parents=True, exist_ok=True)

    folder_name = "Uploaded_Project"
    if paths and paths[0]:
        folder_name = paths[0].replace("\\", "/").split("/")[0] or "Uploaded_Project"
    elif files and files[0].filename:
        folder_name = files[0].filename.replace("\\", "/").split("/")[0] or "Uploaded_Project"

    for idx, file in enumerate(files):
        # Determine relative path from form 'paths' or filename
        rel_str = (paths[idx] if paths and idx < len(paths) and paths[idx] else file.filename)
        rel_str = rel_str.replace("\\", "/").lstrip("/")
        
        file_dest = (target_dir / rel_str).resolve()
        # Prevent zip-slip or directory traversal escape
        if not file_dest.is_relative_to(target_dir.resolve()):
            continue

        file_dest.parent.mkdir(parents=True, exist_ok=True)
        with open(file_dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

    # Check if files were contained in an outer root directory
    top_entries = list(target_dir.iterdir())
    scan_dir = target_dir
    subdirs = [p for p in top_entries if p.is_dir() and p.name not in ("__MACOSX", ".git")]
    if len(subdirs) == 1 and not any(p.is_file() for p in top_entries):
        scan_dir = subdirs[0]

    return _process_scanned_repo(str(scan_dir), display_name=folder_name, api_key=api_key)


@app.post("/api/upload-folder-chunk")
async def upload_folder_chunk(
    session_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    is_last_chunk: bool = Form(...),
    folder_name: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    paths: Optional[List[str]] = Form(None)
):
    """
    Handles batched chunked uploads of large project folders containing > 1,000 files.
    Files are streamed and unpacked iteratively into the session directory.
    When is_last_chunk is True, triggers the full AST scan and diagram generation.
    """
    clean_session = re.sub(r'[^a-zA-Z0-9_\-]', '', session_id) or "upload"
    temp_base = TEMP_ROOT / "uploads"
    temp_base.mkdir(parents=True, exist_ok=True)
    target_dir = temp_base / f"chunked_{clean_session}"
    target_dir.mkdir(parents=True, exist_ok=True)

    for idx, file in enumerate(files):
        rel_str = (paths[idx] if paths and idx < len(paths) and paths[idx] else file.filename)
        rel_str = rel_str.replace("\\", "/").lstrip("/")

        file_dest = (target_dir / rel_str).resolve()
        if not file_dest.is_relative_to(target_dir.resolve()):
            continue

        file_dest.parent.mkdir(parents=True, exist_ok=True)
        with open(file_dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

    if not is_last_chunk:
        return {
            "status": "chunk_received",
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "received_files_in_chunk": len(files)
        }

    # Final chunk received: process the full scanned repository
    top_entries = list(target_dir.iterdir())
    scan_dir = target_dir
    subdirs = [p for p in top_entries if p.is_dir() and p.name not in ("__MACOSX", ".git")]
    if len(subdirs) == 1 and not any(p.is_file() for p in top_entries):
        scan_dir = subdirs[0]

    disp_name = folder_name or "Uploaded_Project"
    return _process_scanned_repo(str(scan_dir), display_name=disp_name, api_key=api_key)


@app.post("/api/upload-zip")
async def upload_zip_project(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None)
):
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .zip archive")

    temp_base = TEMP_ROOT / "uploads"
    temp_base.mkdir(parents=True, exist_ok=True)
    upload_id = uuid.uuid4().hex[:8]
    target_dir = temp_base / f"zip_{upload_id}"
    target_dir.mkdir(parents=True, exist_ok=True)

    zip_path = target_dir / "project.zip"
    with open(zip_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    extract_dir = target_dir / "extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                member_path = Path(extract_dir) / member.filename
                if not member_path.resolve().is_relative_to(extract_dir.resolve()):
                    continue
                zip_ref.extract(member, extract_dir)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract zip archive: {str(e)}")

    # Check if there is a single root folder inside zip
    extracted_items = [p for p in extract_dir.iterdir() if p.name not in ("__MACOSX", ".DS_Store")]
    scan_dir = extract_dir
    if len(extracted_items) == 1 and extracted_items[0].is_dir():
        scan_dir = extracted_items[0]

    zip_display_name = Path(file.filename).stem
    return _process_scanned_repo(str(scan_dir), display_name=zip_display_name, api_key=api_key)


@app.post("/api/restore-session")
def restore_session(req: RestoreSessionRequest):
    """
    Restores an active exploration session from previously saved Supabase documents,
    enabling full AI code Q&A, diagram viewing, and code explanation without re-uploading.
    """
    repo_data = {
        "repo_name": req.repo_name,
        "repo_path": req.repo_path or f"supabase://{req.repo_name}",
        "total_files": req.total_files,
        "total_loc": req.total_loc,
        "languages": req.languages or {},
        "files": req.files or {},
        "tree": req.tree,
        "readme": None,
    }
    CURRENT_SESSION["repo_data"] = repo_data
    if req.diagrams:
        CURRENT_SESSION["diagrams"] = req.diagrams
    if req.explanation:
        CURRENT_SESSION["explanation"] = req.explanation

    return {
        "status": "success",
        "message": f"Session restored successfully for {req.repo_name}",
        "files_count": len(req.files or {})
    }


@app.get("/api/file")
def get_file_content(path: str = Query(..., description="Relative file path")):
    repo_data = CURRENT_SESSION.get("repo_data")
    if not repo_data:
        raise HTTPException(status_code=400, detail="No repository has been scanned yet")

    clean_path = path.replace("\\", "/").lstrip("/")
    file_info = repo_data.get("files", {}).get(clean_path)
    if not file_info:
        raise HTTPException(status_code=404, detail=f"File not found in scanned data: {path}")

    # 1. Return in-memory content if already loaded (e.g. from Supabase or previous scan)
    if file_info.get("content") is not None and file_info.get("content") != "":
        return {
            "path": clean_path,
            "name": file_info.get("name"),
            "language": file_info.get("language"),
            "loc": file_info.get("loc"),
            "analysis": file_info.get("analysis"),
            "content": file_info.get("content")
        }

    # 2. Otherwise read actual file content from disk
    full_path = Path(repo_data.get("repo_path", "")) / clean_path
    content = ""
    if full_path.exists() and full_path.is_file():
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception as e:
            content = f"Error reading file content: {str(e)}"

    return {
        "path": clean_path,
        "name": file_info.get("name"),
        "language": file_info.get("language"),
        "loc": file_info.get("loc"),
        "analysis": file_info.get("analysis"),
        "content": content
    }


@app.post("/api/ask")
def ask_question(req: AskRequest):
    repo_data = CURRENT_SESSION.get("repo_data")
    if not repo_data:
        raise HTTPException(status_code=400, detail="Please scan a repository first before asking questions")

    res = answer_repository_query(
        req.query,
        repo_data,
        api_key=req.api_key,
        active_file=req.active_file,
        history=req.history
    )
    return res


@app.post("/api/explain-code")
def explain_code(req: CodeExplainRequest):
    repo_data = CURRENT_SESSION.get("repo_data")
    code = req.code or ""
    file_info = None
    file_path = req.file_path or "snippet"

    # If file_path is provided and we have repo_data, retrieve file details and content
    if req.file_path and repo_data:
        clean_path = req.file_path.replace("\\", "/").lstrip("/")
        file_info = repo_data.get("files", {}).get(clean_path)
        if not code:
            full_path = Path(repo_data["repo_path"]) / clean_path
            if full_path.exists() and full_path.is_file():
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        code = f.read()
                except Exception as e:
                    code = f"# Error reading file: {str(e)}"

    if not code.strip():
        raise HTTPException(status_code=400, detail="No code content provided to explain.")

    res = explain_file_code(
        file_path=file_path,
        code=code,
        file_info=file_info,
        repo_data=repo_data,
        mode=req.mode or "full",
        api_key=req.api_key,
        symbol_name=req.symbol_name
    )
    return res


# Mount React frontend static distribution if built (for Render/production deployment)
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API routes that might have failed with 404
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")


