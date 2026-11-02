import networkx as nx
from pathlib import Path
from typing import Dict, List, Any, Set, Tuple

class DependencyGraphBuilder:
    def __init__(self, repo_data: Dict[str, Any]):
        self.repo_data = repo_data
        self.files = repo_data.get("files", {})
        self.module_graph = nx.DiGraph()
        self.call_graph = nx.DiGraph()
        self.file_path_map = self._build_path_map()

    def _build_path_map(self) -> Dict[str, str]:
        # Maps Python dot-notations or file basenames to relative file paths
        # e.g., "app.parser.python_analyzer" -> "backend/app/parser/python_analyzer.py"
        path_map: Dict[str, str] = {}
        for rel_path in self.files.keys():
            p = Path(rel_path)
            # 1. Direct path without extension
            stem_path = (p.parent / p.stem).as_posix()
            path_map[stem_path] = rel_path
            
            # 2. Dot notation
            dot_path = stem_path.replace("/", ".")
            path_map[dot_path] = rel_path
            
            # 3. Just the stem
            if p.stem not in path_map:
                path_map[p.stem] = rel_path
                
            # 4. Suffix parts of dot path
            parts = stem_path.split("/")
            for i in range(len(parts)):
                sub_dot = ".".join(parts[i:])
                if sub_dot not in path_map:
                    path_map[sub_dot] = rel_path

        return path_map

    def resolve_import(self, source_path: str, import_item: Dict[str, Any]) -> str | None:
        raw_mod = import_item.get("module") or ""
        import_name = import_item.get("name") or ""
        
        # Check relative import (e.g. from .python_analyzer import ...)
        level = import_item.get("level", 0)
        if level and level > 0:
            source_parts = source_path.split("/")[:-1]
            parent_parts = source_parts[:len(source_parts) - (level - 1)]
            target_stem = "/".join(parent_parts + [raw_mod]) if raw_mod else "/".join(parent_parts)
            if target_stem in self.file_path_map:
                return self.file_path_map[target_stem]
            if raw_mod in self.file_path_map:
                return self.file_path_map[raw_mod]
            if import_name and f"{target_stem}/{import_name}" in self.file_path_map:
                return self.file_path_map[f"{target_stem}/{import_name}"]

        # Exact or partial match
        if raw_mod in self.file_path_map:
            return self.file_path_map[raw_mod]
        
        # If JS/TS import like './components/Header'
        if raw_mod.startswith("./") or raw_mod.startswith("../"):
            source_dir = Path(source_path).parent
            norm_rel = Path(source_dir / raw_mod).as_posix()
            # Clean dot segments like frontend/src/../src/components/Header
            clean_parts = []
            for part in norm_rel.split("/"):
                if part == "." or not part:
                    continue
                elif part == ".." and clean_parts:
                    clean_parts.pop()
                else:
                    clean_parts.append(part)
            clean_norm = "/".join(clean_parts)
            if clean_norm in self.file_path_map:
                return self.file_path_map[clean_norm]

            clean_rel = Path(raw_mod).name
            if clean_rel in self.file_path_map:
                return self.file_path_map[clean_rel]

        # Combine module + name (e.g. from parser import python_analyzer)
        combined = f"{raw_mod}.{import_name}" if raw_mod and import_name else ""
        if combined in self.file_path_map:
            return self.file_path_map[combined]

        return None

    def build(self) -> Dict[str, Any]:
        # Add nodes for all analyzed files
        for rel_path, data in self.files.items():
            loc = data.get("loc", 0)
            lang = data.get("language", "unknown")
            cls_count = len(data.get("analysis", {}).get("classes", []))
            fn_count = len(data.get("analysis", {}).get("functions", []))
            
            self.module_graph.add_node(
                rel_path,
                label=Path(rel_path).name,
                language=lang,
                loc=loc,
                classes=cls_count,
                functions=fn_count
            )

        # Add edges based on imports
        for source_path, data in self.files.items():
            analysis = data.get("analysis", {})
            imports = analysis.get("imports", [])

            for imp in imports:
                target_path = self.resolve_import(source_path, imp)
                if target_path and target_path != source_path:
                    if self.module_graph.has_node(target_path):
                        self.module_graph.add_edge(source_path, target_path)

        # Compute graph metrics
        try:
            in_degree = dict(self.module_graph.in_degree())
            out_degree = dict(self.module_graph.out_degree())
            degree_centrality = nx.degree_centrality(self.module_graph)
        except Exception:
            in_degree = {}
            out_degree = {}
            degree_centrality = {}

        # Circular dependencies
        try:
            cycles = list(nx.simple_cycles(self.module_graph))
        except Exception:
            cycles = []

        # Find most critical / central modules
        most_depended_on = sorted(in_degree.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Prepare JSON serializable structure
        nodes = []
        for n, attrs in self.module_graph.nodes(data=True):
            nodes.append({
                "id": n,
                "label": attrs.get("label", n),
                "language": attrs.get("language", "text"),
                "loc": attrs.get("loc", 0),
                "inDegree": in_degree.get(n, 0),
                "outDegree": out_degree.get(n, 0),
                "centrality": round(degree_centrality.get(n, 0), 3)
            })

        edges = []
        for u, v in self.module_graph.edges():
            edges.append({
                "source": u,
                "target": v
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "cycles_count": len(cycles),
                "cycles": cycles[:5],
                "top_depended": [{"file": k, "dependents_count": v} for k, v in most_depended_on if v > 0]
            }
        }
