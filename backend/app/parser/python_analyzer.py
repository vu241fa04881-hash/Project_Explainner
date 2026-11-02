import ast
from pathlib import Path
from typing import Dict, List, Any, Optional

class PythonASTAnalyzer(ast.NodeVisitor):
    def __init__(self, file_path: str, code: str):
        self.file_path = file_path
        self.code = code
        self.lines = code.splitlines()
        self.total_lines = len(self.lines)
        
        self.imports: List[Dict[str, Any]] = []
        self.classes: List[Dict[str, Any]] = []
        self.functions: List[Dict[str, Any]] = []
        self.calls: List[Dict[str, Any]] = []
        self.current_class: Optional[str] = None
        self.current_function: Optional[str] = None
        self.module_docstring: Optional[str] = None

    def analyze(self) -> Dict[str, Any]:
        try:
            tree = ast.parse(self.code, filename=self.file_path)
            self.module_docstring = ast.get_docstring(tree)
            self.visit(tree)
        except SyntaxError as e:
            return {
                "file_path": self.file_path,
                "error": f"Syntax error at line {e.lineno}: {e.msg}",
                "total_lines": self.total_lines,
                "imports": [],
                "classes": [],
                "functions": [],
                "calls": [],
                "module_docstring": None
            }
        except Exception as e:
            return {
                "file_path": self.file_path,
                "error": str(e),
                "total_lines": self.total_lines,
                "imports": [],
                "classes": [],
                "functions": [],
                "calls": [],
                "module_docstring": None
            }

        return {
            "file_path": self.file_path,
            "total_lines": self.total_lines,
            "module_docstring": self.module_docstring,
            "imports": self.imports,
            "classes": self.classes,
            "functions": self.functions,
            "calls": self.calls
        }

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append({
                "module": alias.name,
                "alias": alias.asname,
                "line": node.lineno,
                "is_from": False
            })
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        mod = node.module or ""
        for alias in node.names:
            self.imports.append({
                "module": mod,
                "name": alias.name,
                "alias": alias.asname,
                "level": node.level,
                "line": node.lineno,
                "is_from": True
            })
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        prev_class = self.current_class
        self.current_class = node.name

        doc = ast.get_docstring(node)
        bases = []
        for base in node.bases:
            if isinstance(base, ast.Name):
                bases.append(base.id)
            elif isinstance(base, ast.Attribute):
                bases.append(f"{self._get_attr_name(base)}")
        
        methods = []
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                m_args = [a.arg for a in item.args.args]
                m_doc = ast.get_docstring(item)
                methods.append({
                    "name": item.name,
                    "is_async": isinstance(item, ast.AsyncFunctionDef),
                    "args": m_args,
                    "doc": m_doc,
                    "line": item.lineno
                })

        self.classes.append({
            "name": node.name,
            "doc": doc,
            "bases": bases,
            "methods": methods,
            "line": node.lineno,
            "end_line": getattr(node, "end_lineno", node.lineno)
        })

        self.generic_visit(node)
        self.current_class = prev_class

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._record_function(node, is_async=False)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._record_function(node, is_async=True)

    def _record_function(self, node, is_async: bool):
        # If top level or nested
        prev_func = self.current_function
        full_name = f"{self.current_class}.{node.name}" if self.current_class else node.name
        self.current_function = full_name

        if not self.current_class: # Top level function
            doc = ast.get_docstring(node)
            args = [a.arg for a in node.args.args]
            decorators = []
            for dec in node.decorator_list:
                if isinstance(dec, ast.Name):
                    decorators.append(dec.id)
                elif isinstance(dec, ast.Attribute):
                    decorators.append(self._get_attr_name(dec))
                elif isinstance(dec, ast.Call):
                    if isinstance(dec.func, ast.Name):
                        decorators.append(dec.func.id)
                    elif isinstance(dec.func, ast.Attribute):
                        decorators.append(self._get_attr_name(dec.func))

            self.functions.append({
                "name": node.name,
                "is_async": is_async,
                "args": args,
                "decorators": decorators,
                "doc": doc,
                "line": node.lineno,
                "end_line": getattr(node, "end_lineno", node.lineno)
            })

        self.generic_visit(node)
        self.current_function = prev_func

    def visit_Call(self, node: ast.Call):
        func_name = ""
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = self._get_attr_name(node.func)
        
        if func_name:
            self.calls.append({
                "caller_function": self.current_function,
                "caller_class": self.current_class,
                "called": func_name,
                "line": node.lineno
            })
        self.generic_visit(node)

    def _get_attr_name(self, node: ast.Attribute) -> str:
        parts = []
        curr = node
        while isinstance(curr, ast.Attribute):
            parts.append(curr.attr)
            curr = curr.value
        if isinstance(curr, ast.Name):
            parts.append(curr.id)
        return ".".join(reversed(parts))


def analyze_python_file(file_path: str, code: str) -> Dict[str, Any]:
    analyzer = PythonASTAnalyzer(file_path, code)
    return analyzer.analyze()
