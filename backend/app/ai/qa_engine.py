import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from google import genai

ENTRY_POINT_NAMES = [
    "index.html", "main.py", "app.py", "script.js", "index.js",
    "App.jsx", "App.tsx", "main.jsx", "main.tsx", "server.js",
    "README.md", "readme.md", "package.json"
]

def find_relevant_files(query: str, repo_data: Dict[str, Any], max_files: int = 6) -> List[Dict[str, Any]]:
    files = repo_data.get("files", {})
    repo_root = Path(repo_data.get("repo_path", ""))
    total_files = len(files)

    # For small projects (e.g. 15 files or fewer), return ALL files so Gemini has 100% full project context!
    if total_files <= 15:
        return list(files.values())

    query_terms = [t.lower() for t in query.split() if len(t) > 2]
    scores = []
    is_general_query = any(w in query.lower() for w in [
        "title", "name", "about", "explain", "logic", "how it work",
        "overview", "summary", "architecture", "what does", "run", "start"
    ])

    for path, data in files.items():
        score = 0
        p_lower = path.lower()
        filename = Path(path).name.lower()
        analysis = data.get("analysis", {})

        # Priority for entry point files on general queries
        if is_general_query and filename in [e.lower() for e in ENTRY_POINT_NAMES]:
            score += 15

        # Term matches in path or filename
        for term in query_terms:
            if term in filename:
                score += 8
            elif term in p_lower:
                score += 5

        # Term matches in classes
        for c in analysis.get("classes", []):
            c_name = c.get("name", "").lower()
            for term in query_terms:
                if term in c_name:
                    score += 6

        # Term matches in functions
        for f in analysis.get("functions", []):
            f_name = f.get("name", "").lower()
            for term in query_terms:
                if term in f_name:
                    score += 6

        # Term matches in HTML title/description metadata
        metadata = analysis.get("metadata", {})
        if metadata:
            meta_str = f"{metadata.get('title', '')} {metadata.get('description', '')}".lower()
            for term in query_terms:
                if term in meta_str:
                    score += 10

        # Term matches inside the actual file content (read up to 300 lines)
        if query_terms and repo_root.exists():
            full_path = repo_root / path
            if full_path.exists() and full_path.is_file():
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as fp:
                        content_sample = fp.read(4000).lower()
                        for term in query_terms:
                            if term in content_sample:
                                score += 8
                except Exception:
                    pass

        if score > 0 or is_general_query:
            scores.append((score, path, data))

    scores.sort(key=lambda x: x[0], reverse=True)
    return [item[2] for item in scores[:max_files]]


def answer_repository_query(
    query: str,
    repo_data: Dict[str, Any],
    api_key: Optional[str] = None,
    active_file: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    active_key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()
    repo_root = Path(repo_data.get("repo_path", ""))
    relevant = find_relevant_files(query, repo_data, max_files=8)
    files = repo_data.get("files", {})

    # Extract clean project title and description
    project_title = repo_data.get("project_title") or repo_data.get("repo_name", "Unknown Project")
    project_desc = repo_data.get("project_description", "")

    # If project_title is still generic, look inside index.html or package.json
    if project_title in ["mini project", "Uploaded_Project", "repo", "Unknown Project"]:
        for p, d in files.items():
            meta = d.get("analysis", {}).get("metadata", {})
            if meta.get("title"):
                project_title = meta["title"]
                if meta.get("description"):
                    project_desc = meta["description"]
                break

    # Prioritize active file if specified
    active_file_info = None
    if active_file:
        clean_active = active_file.replace("\\", "/").lstrip("/")
        if clean_active in files:
            active_file_info = files[clean_active]
            if not any(f.get("path") == clean_active for f in relevant):
                relevant.insert(0, active_file_info)

    # Heuristic Answer if no API key is provided
    if not active_key:
        q_lower = query.lower()
        matched_details = []

        if "title" in q_lower or "name" in q_lower:
            matched_details.append(
                f"### Project Title & Identity:\n"
                f"- **Title:** **{project_title}**\n"
                + (f"- **Description:** {project_desc}\n" if project_desc else "")
                + f"- **Total Files:** {repo_data.get('total_files')}, **Lines of Code:** {repo_data.get('total_loc')}"
            )

        # Logic overview heuristic
        if "logic" in q_lower or "how" in q_lower or "work" in q_lower:
            logic_hints = []
            for p, d in files.items():
                funcs = d.get("analysis", {}).get("functions", [])
                if funcs:
                    fn_names = [fn["name"] for fn in funcs[:8]]
                    logic_hints.append(f"- **`{p}`**: Implements `{', '.join(fn_names)}`")
                elif p.endswith(".html"):
                    meta = d.get("analysis", {}).get("metadata", {})
                    h1 = meta.get("h1", [])
                    logic_hints.append(f"- **`{p}`**: Primary UI view (Title: '{meta.get('title', 'N/A')}', Headings: {', '.join(h1) if h1 else 'None'})")
            if logic_hints:
                matched_details.append("### Detected Code Logics & Modules:\n" + "\n".join(logic_hints))

        if active_file_info:
            af_analysis = active_file_info.get("analysis", {})
            funcs = [fn["name"] for fn in af_analysis.get("functions", [])[:6]]
            matched_details.append(
                f"### Active Inspected File: `{active_file_info.get('path')}`\n"
                f"- **Functions:** {', '.join(funcs) if funcs else 'None detected'}\n"
                f"- **Lines of Code:** {active_file_info.get('loc', 0)}"
            )

        rel_names = [f.get("path", "unknown") for f in relevant[:5]]
        if rel_names:
            matched_details.append(
                "### Key Modules in Scope:\n"
                + "\n".join([f"- **`{r}`** (Language: {f.get('language', 'code')}, LOC: {f.get('loc', 0)})" for f, r in zip(relevant[:5], rel_names)])
            )

        if not matched_details:
            answer = (
                f"**Project Summary for {project_title}:**\n\n"
                f"Files in project: {', '.join(list(files.keys())[:8])}.\n\n"
                "💡 **Tip:** Add a Gemini API Key in the top navigation bar to receive deep generative explanations of algorithms, line-by-line logic, and code modifications."
            )
        else:
            answer = (
                f"**Code Intelligence for {project_title}:**\n\n"
                + "\n\n".join(matched_details)
                + "\n\n---\n*💡 **Tip:** Add your Gemini API Key in the top bar for deep conversational explanations, step-by-step logic traces, and code generation.*"
            )

        return {
            "query": query,
            "answer": answer,
            "sources": [f.get("path", "") for f in relevant if f.get("path")],
            "is_ai": False
        }

    # Build rich, code-inclusive context for Gemini
    context_chunks = []

    # Include project overview block
    context_chunks.append(
        f"=== PROJECT OVERVIEW ===\n"
        f"Title: {project_title}\n"
        f"Description: {project_desc or 'Web / software application'}\n"
        f"Total Files: {repo_data.get('total_files')}\n"
        f"Languages: {list(repo_data.get('languages', {}).keys())}\n"
        f"=== END PROJECT OVERVIEW ==="
    )

    # Manifests (package.json / requirements.txt)
    manifests = repo_data.get("manifests", {})
    if manifests:
        manifest_text = []
        for k, v in manifests.items():
            if isinstance(v, dict):
                manifest_text.append(f"{k}: dependencies={list(v.get('dependencies', {}).keys())}")
            else:
                manifest_text.append(f"{k}: {str(v)[:500]}")
        context_chunks.append("=== MANIFESTS & DEPENDENCIES ===\n" + "\n".join(manifest_text) + "\n================================")

    # Read the actual source code of relevant files
    for f in relevant:
        f_path = f.get("path", "")
        f_loc = f.get("loc", 0)
        f_lang = f.get("language", "text")
        analysis = f.get("analysis", {})
        meta = analysis.get("metadata", {})
        classes = [c.get("name") for c in analysis.get("classes", [])]
        functions = [fn.get("name") for fn in analysis.get("functions", [])]

        # Read actual file code from disk
        file_code = ""
        full_path = repo_root / f_path
        if full_path.exists() and full_path.is_file():
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as fp:
                    lines = fp.readlines()
                    # For small to medium files (<= 400 lines), provide complete file!
                    if len(lines) <= 400:
                        file_code = "".join(lines)
                    else:
                        file_code = "".join(lines[:300]) + f"\n... [code continues for {len(lines) - 300} more lines]"
            except Exception:
                pass

        file_chunk = [f"--- FILE: {f_path} (Language: {f_lang}, {f_loc} lines) ---"]
        if meta.get("title"):
            file_chunk.append(f"HTML Document Title: '{meta['title']}'")
        if meta.get("description"):
            file_chunk.append(f"HTML Meta Description: '{meta['description']}'")
        if classes:
            file_chunk.append(f"Classes Defined: {', '.join(classes)}")
        if functions:
            file_chunk.append(f"Functions Defined: {', '.join(functions)}")
        if file_code:
            file_chunk.append(f"Actual Source Code:\n```\n{file_code}\n```")
        file_chunk.append("--- END FILE ---")

        context_chunks.append("\n".join(file_chunk))

    context_str = "\n\n".join(context_chunks)

    # Format history if present
    history_str = ""
    if history and isinstance(history, list):
        recent_history = history[-6:]
        hist_parts = []
        for h in recent_history:
            role = "User" if h.get("role") == "user" else "Assistant"
            hist_parts.append(f"{role}: {h.get('text') or h.get('content', '')}")
        if hist_parts:
            history_str = "Prior Conversation History:\n" + "\n".join(hist_parts) + "\n\n"

    prompt = f"""You are the lead software engineer, architect, and explainer for this project: '{project_title}'.
You have full, direct access to the actual source code of the project files below.

{history_str}User Question: {query}

{context_str}

Guidelines & Instructions:
1. Always inspect and cite the actual source code provided above.
2. If asked about the project title or what the project is, give the exact title (e.g. from the HTML <title>, package.json, or README) and concisely explain what the application does.
3. When explaining project logic:
   - Walk through the core state variables (e.g. arrays, objects, flags).
   - Explain how user interactions or event listeners trigger actions.
   - Explain what functions are called, how calculations/transformations are made, and how the UI/DOM updates.
   - Quote exact function names, variable names, and code snippets from the files.
4. Keep the tone practical, clear, structured, and easy to understand. Use Markdown bullet points, bold headers, and code blocks.
"""

    preferred_models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
    ]
    last_err = None

    try:
        client = genai.Client(api_key=active_key)
        for model_name in preferred_models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if response and response.text:
                    return {
                        "query": query,
                        "answer": response.text,
                        "sources": [f.get("path", "") for f in relevant if f.get("path")],
                        "is_ai": True,
                        "model_used": model_name
                    }
            except Exception as e:
                last_err = e
                continue

        raise last_err or Exception("Failed to generate response from Gemini")
    except Exception as e:
        return {
            "query": query,
            "answer": f"Error communicating with Gemini: {str(e)}",
            "sources": [f.get("path", "") for f in relevant if f.get("path")],
            "is_ai": False
        }
