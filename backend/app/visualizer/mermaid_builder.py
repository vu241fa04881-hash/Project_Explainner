from pathlib import Path
from typing import Dict, List, Any

def sanitize_id(raw_str: str) -> str:
    cleaned = "".join(c if (c.isalnum() or c == "_") else "_" for c in str(raw_str)).strip("_")
    if not cleaned:
        cleaned = "node"
    if cleaned[0].isdigit():
        cleaned = f"n_{cleaned}"
    return cleaned

def build_dependency_mermaid(graph_data: Dict[str, Any], direction: str = "TD", max_nodes: int = 50) -> str:
    nodes = graph_data.get("nodes", [])[:max_nodes]
    node_ids = {n["id"] for n in nodes}
    edges = [e for e in graph_data.get("edges", []) if e["source"] in node_ids and e["target"] in node_ids]

    if not nodes:
        return f"flowchart {direction}\n    empty[\"No modules detected\"]"

    lines = [f"flowchart {direction}"]
    lines.append("    %% Styling Classes")
    lines.append("    classDef python fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;")
    lines.append("    classDef javascript fill:#1e293b,stroke:#facc15,stroke-width:2px,color:#f8fafc;")
    lines.append("    classDef typescript fill:#1e293b,stroke:#60a5fa,stroke-width:2px,color:#f8fafc;")
    lines.append("    classDef defaultNode fill:#1e293b,stroke:#94a3b8,stroke-width:1px,color:#f8fafc;")

    # Group by parent folder
    folders: Dict[str, List[Dict[str, Any]]] = {}
    for node in nodes:
        p = Path(node["id"])
        folder = p.parent.as_posix()
        if folder == ".":
            folder = "Root"
        folders.setdefault(folder, []).append(node)

    for folder, folder_nodes in folders.items():
        sub_id = "cluster_" + sanitize_id(folder)
        folder_display = folder.replace('"', "'")
        lines.append(f'    subgraph {sub_id} ["{folder_display}/"]')
        for node in folder_nodes:
            sid = sanitize_id(node["id"])
            lbl = node["label"].replace('"', "'")
            lines.append(f'        {sid}["{lbl}"]')
            lang = node.get("language", "defaultNode")
            if lang in ["python", "javascript", "typescript"]:
                lines.append(f"        class {sid} {lang};")
            else:
                lines.append(f"        class {sid} defaultNode;")
        lines.append("    end")

    # Edges
    for edge in edges:
        s_id = sanitize_id(edge["source"])
        t_id = sanitize_id(edge["target"])
        lines.append(f"    {s_id} --> {t_id}")

    return "\n".join(lines)


def build_class_mermaid(files_data: Dict[str, Any], max_classes: int = 15) -> str:
    lines = ["classDiagram"]
    class_count = 0
    seen_classes = set()
    
    for file_path, data in files_data.items():
        analysis = data.get("analysis", {})
        classes = analysis.get("classes", [])
        
        for cls in classes:
            if class_count >= max_classes:
                break
            c_name = cls.get("name", "")
            if not c_name or c_name in seen_classes:
                continue
            
            clean_name = sanitize_id(c_name)
            seen_classes.add(c_name)
            lines.append(f"    class {clean_name} {{")
            
            # Methods
            for m in cls.get("methods", [])[:5]:
                m_name = sanitize_id(m.get("name", "method"))
                clean_args = ", ".join([sanitize_id(a) for a in m.get("args", [])[:3]])
                lines.append(f"        +{m_name}({clean_args})")
            lines.append("    }")
            
            # Bases
            for base in cls.get("bases", []):
                clean_base = sanitize_id(base)
                if clean_base and clean_base != clean_name:
                    lines.append(f"    {clean_base} <|-- {clean_name}")
            
            class_count += 1

    if class_count == 0:
        return "classDiagram\n    class Application {\n        +scan_repository()\n        +generate_graph()\n    }"

    return "\n".join(lines)


def build_architecture_layers_mermaid(repo_data: Dict[str, Any]) -> str:
    files = repo_data.get("files", {})
    code_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".go", ".rs", ".java", ".c", ".cpp"}
    
    ui_frontend = []
    api_entrypoints = []
    core_logic = []
    utilities_parsers = []

    for path in sorted(files.keys()):
        p = Path(path)
        ext = p.suffix.lower()
        if ext not in code_exts:
            continue
        
        # Don't show __init__.py files in architecture layer diagram
        if p.name == "__init__.py":
            continue

        parts = [part.lower() for part in p.parts]
        name_lower = p.name.lower()

        if any(part in ["frontend", "components", "component", "ui", "views", "pages"] for part in parts) or ext in [".jsx", ".tsx"]:
            ui_frontend.append(path)
        elif any(part in ["api", "routes", "routers", "controllers", "server"] for part in parts) or name_lower in ["main.py", "app.py", "server.py", "server.js", "main.go"]:
            api_entrypoints.append(path)
        elif any(part in ["parser", "graph", "scanner", "util", "utils", "helper", "helpers", "visualizer", "analyzer", "infra"] for part in parts):
            utilities_parsers.append(path)
        else:
            core_logic.append(path)

    lines = ["flowchart TB"]
    lines.append("    classDef layerBox fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;")
    lines.append("    classDef itemBox fill:#1e293b,stroke:#64748b,stroke-width:1px,color:#cbd5e1;")

    # 1. UI
    lines.append('    subgraph UI ["1. Presentation & Interface Layer"]')
    lines.append("        style UI fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#ddd6fe;")
    if ui_frontend:
        for p_item in ui_frontend[:6]:
            node_id = f"ui_{sanitize_id(p_item)}"
            lbl = Path(p_item).name.replace('"', "'")
            lines.append(f'        {node_id}["{lbl}"]')
    else:
        lines.append('        ui_client["Interactive Web UI / Dashboard"]')
    lines.append("    end")

    # 2. API
    lines.append('    subgraph API ["2. Entrypoints & API Controllers"]')
    lines.append("        style API fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#bfdbfe;")
    if api_entrypoints:
        for p_item in api_entrypoints[:6]:
            node_id = f"api_{sanitize_id(p_item)}"
            lbl = Path(p_item).name.replace('"', "'")
            lines.append(f'        {node_id}["{lbl}"]')
    else:
        lines.append('        api_entry["FastAPI Service Router"]')
    lines.append("    end")

    # 3. DOMAIN
    lines.append('    subgraph DOMAIN ["3. Domain & Intelligence Services"]')
    lines.append("        style DOMAIN fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#a7f3d0;")
    if core_logic:
        for p_item in core_logic[:6]:
            node_id = f"core_{sanitize_id(p_item)}"
            lbl = Path(p_item).name.replace('"', "'")
            lines.append(f'        {node_id}["{lbl}"]')
    else:
        lines.append('        core_engine["AI Explainer & QA Engine"]')
    lines.append("    end")

    # 4. INFRA
    lines.append('    subgraph INFRA ["4. Code Parsing & Graph Engine"]')
    lines.append("        style INFRA fill:#0f172a,stroke:#f59e0b,stroke-width:2px,color:#fde68a;")
    if utilities_parsers:
        for p_item in utilities_parsers[:6]:
            node_id = f"infra_{sanitize_id(p_item)}"
            lbl = Path(p_item).name.replace('"', "'")
            lines.append(f'        {node_id}["{lbl}"]')
    else:
        lines.append('        infra_parser["AST Visitor & NetworkX Builder"]')
    lines.append("    end")

    lines.append("    UI --> API")
    lines.append("    API --> DOMAIN")
    lines.append("    DOMAIN --> INFRA")

    return "\n".join(lines)
