import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

from .python_analyzer import analyze_python_file
from .generic_analyzer import analyze_generic_file

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", ".cache", ".gemini", ".system_generated",
    ".idea", ".vscode", ".pytest_cache", ".ruff_cache", "coverage", "eggs", ".tox"
}

IGNORE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    ".DS_Store", "Thumbs.db"
}

SUPPORTED_EXTENSIONS = {
    # Python
    ".py": "python",
    # JavaScript & TypeScript
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mjs": "javascript",
    # Data & Schema Files (Supports massive data stores)
    ".csv": "csv",
    ".tsv": "tsv",
    ".json": "json",
    ".jsonl": "jsonl",
    ".sql": "sql",
    ".xml": "xml",
    ".parquet": "data",
    ".dat": "data",
    ".data": "data",
    # Config & Markup
    ".toml": "toml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".txt": "text",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "css",
    ".env": "config",
    ".ini": "config",
    ".conf": "config",
    # General Programming Languages
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c_header",
    ".hpp": "cpp_header",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".sh": "shell",
    ".bat": "batch",
    ".ps1": "powershell"
}

DATA_EXTENSIONS = {".csv", ".tsv", ".json", ".jsonl", ".sql", ".xml", ".parquet", ".dat", ".data"}
CODE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".java", ".c", ".cpp", ".cs", ".go", ".rs", ".php", ".rb", ".sh", ".bat", ".ps1"}
CONFIG_EXTENSIONS = {".toml", ".yaml", ".yml", ".env", ".ini", ".conf"}


def get_file_category(ext: str) -> str:
    ext_l = ext.lower()
    if ext_l in DATA_EXTENSIONS:
        return "data"
    if ext_l in CODE_EXTENSIONS:
        return "code"
    if ext_l in CONFIG_EXTENSIONS:
        return "config"
    return "document"


def scan_repository(repo_path: str, max_files: Optional[int] = None, max_file_size_kb: Optional[int] = None) -> Dict[str, Any]:
    root_path = Path(repo_path).resolve()
    if not root_path.exists() or not root_path.is_dir():
        raise ValueError(f"Path does not exist or is not a directory: {repo_path}")

    files_data: Dict[str, Any] = {}
    tree_hierarchy: Dict[str, Any] = {"name": root_path.name, "type": "directory", "children": []}
    readme_content: Optional[str] = None
    manifest_info: Dict[str, Any] = {}
    
    total_loc = 0
    language_counts: Dict[str, int] = {}
    language_lines: Dict[str, int] = {}
    category_counts: Dict[str, int] = {"code": 0, "data": 0, "config": 0, "document": 0}

    # Helper to insert into tree
    def add_to_tree(curr_node: dict, path_parts: list, file_info: dict):
        if len(path_parts) == 1:
            curr_node["children"].append(file_info)
            return
        
        dir_name = path_parts[0]
        # find or create directory node
        for child in curr_node["children"]:
            if child["name"] == dir_name and child["type"] == "directory":
                add_to_tree(child, path_parts[1:], file_info)
                return
        
        new_dir = {"name": dir_name, "type": "directory", "children": []}
        curr_node["children"].append(new_dir)
        add_to_tree(new_dir, path_parts[1:], file_info)

    processed_count = 0

    for current_dir, dirnames, filenames in os.walk(root_path):
        # Filter ignore dirs in-place
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]

        rel_dir = Path(current_dir).relative_to(root_path)

        for filename in filenames:
            if filename in IGNORE_FILES:
                continue
            
            ext = Path(filename).suffix.lower()
            file_path = Path(current_dir) / filename
            rel_file_path = file_path.relative_to(root_path).as_posix()

            try:
                stat = file_path.stat()
                file_size_bytes = stat.st_size
                file_size_kb = file_size_bytes / 1024
            except Exception:
                continue

            # Read README if present
            if filename.lower() == "readme.md" and readme_content is None:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        readme_content = f.read(5000)
                except Exception:
                    pass

            # Detect manifest files
            if filename == "package.json":
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        manifest_info["package_json"] = json.load(f)
                except Exception:
                    pass
            elif filename in ["requirements.txt", "pyproject.toml"]:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        manifest_info[filename] = f.read(2000)
                except Exception:
                    pass

            # High-scale processing: No artificial limit; supports 1000+ files
            is_under_size = (max_file_size_kb is None) or (file_size_kb <= max_file_size_kb)
            is_under_count = (max_files is None) or (processed_count < max_files)

            if ext in SUPPORTED_EXTENSIONS and is_under_size and is_under_count:
                lang = SUPPORTED_EXTENSIONS[ext]
                category = get_file_category(ext)
                language_counts[lang] = language_counts.get(lang, 0) + 1
                category_counts[category] = category_counts.get(category, 0) + 1

                try:
                    # For huge data files (> 2MB), only read a sample snippet for analysis
                    if file_size_kb > 2048:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            code_sample = f.read(65536)
                        loc = sum(1 for _ in open(file_path, "rb"))
                        code_for_analysis = code_sample
                    else:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            code_for_analysis = f.read()
                        loc = len(code_for_analysis.splitlines())

                    total_loc += loc
                    language_lines[lang] = language_lines.get(lang, 0) + loc

                    if ext == ".py":
                        analysis = analyze_python_file(rel_file_path, code_for_analysis)
                    else:
                        analysis = analyze_generic_file(rel_file_path, code_for_analysis, ext)

                    files_data[rel_file_path] = {
                        "path": rel_file_path,
                        "name": filename,
                        "extension": ext,
                        "language": lang,
                        "category": category,
                        "size_kb": round(file_size_kb, 2),
                        "size_bytes": file_size_bytes,
                        "loc": loc,
                        "analysis": analysis
                    }

                    file_node = {
                        "name": filename,
                        "type": "file",
                        "path": rel_file_path,
                        "language": lang,
                        "category": category,
                        "loc": loc,
                        "size_kb": round(file_size_kb, 2),
                        "classes_count": len(analysis.get("classes", [])),
                        "functions_count": len(analysis.get("functions", []))
                    }
                    path_parts = list(rel_file_path.split("/"))
                    add_to_tree(tree_hierarchy, path_parts, file_node)
                    processed_count += 1
                except Exception:
                    pass

    # Extract clean project title and description if available
    project_title = root_path.name
    project_description = None

    # Check HTML title from files
    for fpath, fdata in files_data.items():
        meta = fdata.get("analysis", {}).get("metadata", {})
        if meta.get("title"):
            project_title = meta["title"]
            project_description = meta.get("description")
            break

    if "package_json" in manifest_info and isinstance(manifest_info["package_json"], dict):
        pkg = manifest_info["package_json"]
        if pkg.get("name"):
            project_title = pkg.get("name")
        if pkg.get("description"):
            project_description = pkg.get("description")

    if readme_content and not project_description:
        first_lines = [l.strip() for l in readme_content.splitlines() if l.strip()]
        if first_lines:
            project_description = first_lines[0].lstrip("#").strip()

    return {
        "repo_name": project_title if root_path.name in ["mini project", "Uploaded_Project", "repo"] else root_path.name,
        "project_title": project_title,
        "project_description": project_description,
        "repo_path": str(root_path),
        "total_files": len(files_data),
        "total_loc": total_loc,
        "languages": language_counts,
        "language_lines": language_lines,
        "categories": category_counts,
        "data_files_count": category_counts.get("data", 0),
        "code_files_count": category_counts.get("code", 0),
        "readme": readme_content,
        "manifests": manifest_info,
        "tree": tree_hierarchy,
        "files": files_data
    }
