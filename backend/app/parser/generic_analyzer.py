import re
import csv
import json
import io
from typing import Dict, List, Any

# Regex patterns for JavaScript/TypeScript
JS_IMPORT_REGEX = re.compile(
    r"""(?:import\s+(?:(?:\*\s+as\s+[\w$]+|[\w$]+|\{[\s\w$,*]+\})\s+from\s+)?['"]([^'"]+)['"])|(?:require\(['"]([^'"]+)['"]\))"""
)
JS_CLASS_REGEX = re.compile(
    r"""^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?""",
    re.MULTILINE
)
JS_FN_DECL_REGEX = re.compile(
    r"""^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)"""
)
JS_ARROW_FN_REGEX = re.compile(
    r"""^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>"""
)
JS_METHOD_REGEX = re.compile(
    r"""^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{"""
)

# SQL patterns
SQL_TABLE_REGEX = re.compile(
    r"""(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|FROM|JOIN|INTO|UPDATE)\s+["'`]?([A-Za-z0-9_.]+)["'`]?""",
    re.IGNORECASE
)

IGNORED_FN_NAMES = {
    "if", "for", "while", "switch", "catch", "finally", "return", "throw",
    "with", "import", "export", "function", "constructor", "useEffect",
    "useMemo", "useCallback", "useState", "useRef", "useContext", "useReducer"
}


def analyze_generic_file(file_path: str, code: str, extension: str) -> Dict[str, Any]:
    lines = code.splitlines()
    total_lines = len(lines)
    imports: List[Dict[str, Any]] = []
    classes: List[Dict[str, Any]] = []
    functions: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}

    ext = extension.lower()

    # 1. JavaScript / TypeScript
    if ext in [".js", ".jsx", ".ts", ".tsx", ".mjs"]:
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue

            for match in JS_IMPORT_REGEX.finditer(line):
                mod = match.group(1) or match.group(2)
                if mod:
                    imports.append({
                        "module": mod,
                        "line": i,
                        "is_from": True
                    })

            cls_match = JS_CLASS_REGEX.match(line)
            if cls_match:
                cls_name = cls_match.group(1)
                base = cls_match.group(2)
                classes.append({
                    "name": cls_name,
                    "bases": [base] if base else [],
                    "methods": [],
                    "line": i
                })

            fn_match = JS_FN_DECL_REGEX.match(line)
            if fn_match:
                fn_name = fn_match.group(1)
                raw_args = fn_match.group(2) or ""
                args = [a.strip() for a in raw_args.split(",") if a.strip()]
                functions.append({
                    "name": fn_name,
                    "args": args,
                    "line": i
                })
                continue

            arr_match = JS_ARROW_FN_REGEX.match(line)
            if arr_match:
                fn_name = arr_match.group(1)
                raw_args = arr_match.group(2) or arr_match.group(3) or ""
                args = [a.strip() for a in raw_args.split(",") if a.strip()]
                functions.append({
                    "name": fn_name,
                    "args": args,
                    "line": i
                })
                continue

            mth_match = JS_METHOD_REGEX.match(line)
            if mth_match:
                fn_name = mth_match.group(1)
                if fn_name and fn_name not in IGNORED_FN_NAMES:
                    raw_args = mth_match.group(2) or ""
                    args = [a.strip() for a in raw_args.split(",") if a.strip()]
                    functions.append({
                        "name": fn_name,
                        "args": args,
                        "line": i
                    })

    # 2. Data Files: CSV / TSV
    elif ext in [".csv", ".tsv"]:
        delimiter = "\t" if ext == ".tsv" else ","
        metadata["type"] = "tabular_data"
        metadata["delimiter"] = delimiter
        metadata["estimated_rows"] = max(0, total_lines - 1)
        if lines:
            try:
                reader = csv.reader(io.StringIO(lines[0]), delimiter=delimiter)
                headers = next(reader, [])
                metadata["columns"] = [h.strip() for h in headers if h.strip()][:50]
                metadata["column_count"] = len(metadata["columns"])
            except Exception:
                metadata["columns"] = []

    # 3. Data Files: JSON / JSONL
    elif ext in [".json", ".jsonl"]:
        metadata["type"] = "structured_data"
        if ext == ".json":
            try:
                snippet = code[:50000] # parse head if huge
                parsed = json.loads(code if len(code) < 100000 else snippet.rsplit("}", 1)[0] + "}")
                if isinstance(parsed, dict):
                    metadata["json_format"] = "object"
                    metadata["keys"] = list(parsed.keys())[:50]
                    metadata["key_count"] = len(parsed.keys())
                elif isinstance(parsed, list):
                    metadata["json_format"] = "array"
                    metadata["item_count"] = len(parsed)
                    if parsed and isinstance(parsed[0], dict):
                        metadata["sample_keys"] = list(parsed[0].keys())[:50]
            except Exception:
                metadata["json_format"] = "unknown"
        else:
            metadata["json_format"] = "jsonlines"
            metadata["estimated_rows"] = total_lines

    # 4. Database & Schema Files: SQL
    elif ext == ".sql":
        metadata["type"] = "sql_script"
        tables = set()
        for match in SQL_TABLE_REGEX.finditer(code):
            tbl = match.group(1)
            if tbl and not tbl.upper() in ("SELECT", "WHERE", "GROUP", "ORDER", "TABLE"):
                tables.add(tbl)
        metadata["tables_referenced"] = sorted(list(tables))[:30]

    # 5. Markup: HTML
    elif ext in [".html", ".htm"]:
        title_match = re.search(r"<title>(.*?)</title>", code, re.IGNORECASE | re.DOTALL)
        if title_match:
            metadata["title"] = title_match.group(1).strip()

        desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', code, re.IGNORECASE)
        if desc_match:
            metadata["description"] = desc_match.group(1).strip()

        for script_match in re.finditer(r'<script\s+[^>]*src=["\']([^"\']+)["\']', code, re.IGNORECASE):
            src = script_match.group(1)
            imports.append({"module": src, "line": 1, "is_from": False})

        for link_match in re.finditer(r'<link\s+[^>]*href=["\']([^"\']+\.css)["\']', code, re.IGNORECASE):
            href = link_match.group(1)
            imports.append({"module": href, "line": 1, "is_from": False})

        h1_matches = re.findall(r'<h1[^>]*>(.*?)</h1>', code, re.IGNORECASE | re.DOTALL)
        if h1_matches:
            metadata["h1"] = [re.sub(r'<[^>]+>', '', h).strip() for h in h1_matches[:3]]

    # 6. Other General Programming Languages (Java, Go, Rust, C/C++, C#)
    elif ext in [".java", ".c", ".cpp", ".cs", ".go", ".rs", ".php", ".rb"]:
        metadata["type"] = "code"
        # Extract general function definitions
        fn_pattern = re.compile(r"""(?:public|private|protected|static|final|native|func|fn|def)\s+[\w<>\[\]]+\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)""")
        for i, line in enumerate(lines, 1):
            m = fn_pattern.search(line)
            if m:
                fn_name = m.group(1)
                if fn_name not in ("main", "if", "for", "while"):
                    functions.append({"name": fn_name, "args": [], "line": i})

    return {
        "file_path": file_path,
        "total_lines": total_lines,
        "imports": imports,
        "classes": classes,
        "functions": functions,
        "calls": [],
        "metadata": metadata
    }
