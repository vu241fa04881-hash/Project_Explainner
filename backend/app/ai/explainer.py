import os
from typing import Dict, Any, Optional
from google import genai
from dotenv import load_dotenv

load_dotenv()

PREFERRED_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.8-flash",
]

def build_code_skeleton(repo_data: Dict[str, Any], max_files: int = 60) -> str:
    parts = []
    parts.append(f"# Project: {repo_data.get('repo_name', 'Unknown')}")
    parts.append(f"Total Files Analyzed: {repo_data.get('total_files', 0)}")
    parts.append(f"Total Lines of Code: {repo_data.get('total_loc', 0)}")
    parts.append(f"Languages: {repo_data.get('languages', {})}\n")

    readme = repo_data.get("readme")
    if readme:
        parts.append(f"## README Summary\n{readme[:3000]}\n")

    manifests = repo_data.get("manifests", {})
    if manifests:
        parts.append("## Project Manifests & Dependencies")
        for k, v in manifests.items():
            if isinstance(v, dict):
                deps = v.get("dependencies", {})
                dev_deps = v.get("devDependencies", {})
                parts.append(f"- {k} dependencies: {list(deps.keys())[:25]}")
                if dev_deps:
                    parts.append(f"- {k} devDependencies: {list(dev_deps.keys())[:15]}")
            else:
                parts.append(f"- {k}:\n{str(v)[:1000]}")
        parts.append("")

    parts.append("## Key Module Skeletons & Signatures:")
    files = list(repo_data.get("files", {}).items())[:max_files]
    for path, f_data in files:
        analysis = f_data.get("analysis", {})
        classes = analysis.get("classes", [])
        functions = analysis.get("functions", [])
        imports = analysis.get("imports", [])
        doc = analysis.get("module_docstring")

        parts.append(f"### File: {path} ({f_data.get('loc', 0)} lines)")
        if doc:
            parts.append(f"  Docstring: {doc}")
        if imports:
            import_names = [i.get("name") or i.get("module") for i in imports[:8]]
            parts.append(f"  Imports: {', '.join(filter(None, import_names))}")
        if classes:
            c_summaries = []
            for c in classes[:5]:
                methods = [m["name"] for m in c.get("methods", [])[:6]]
                c_summaries.append(f"{c['name']}(bases={c.get('bases', [])}, methods={', '.join(methods)})")
            parts.append(f"  Classes: {'; '.join(c_summaries)}")
        if functions:
            fn_summaries = [f"{fn['name']}({', '.join(fn.get('args', [])[:4])})" for fn in functions[:8]]
            parts.append(f"  Functions: {', '.join(fn_summaries)}")
        parts.append("")

    return "\n".join(parts)


def generate_heuristic_explanation(repo_data: Dict[str, Any]) -> Dict[str, Any]:
    name = repo_data.get("repo_name", "Project")
    files = repo_data.get("files", {})
    languages = repo_data.get("languages", {})
    manifests = repo_data.get("manifests", {})
    
    detected_frameworks = []
    if "package.json" in manifests:
        deps = manifests["package.json"].get("dependencies", {})
        if "react" in deps:
            detected_frameworks.append("React (for the interactive frontend screen)")
        if "vite" in manifests["package.json"].get("devDependencies", {}) or "vite" in deps:
            detected_frameworks.append("Vite (fast build & dev tool)")
        if "express" in deps:
            detected_frameworks.append("Express (web server)")
    
    for f in files.keys():
        if "fastapi" in f or "main.py" in f:
            detected_frameworks.append("FastAPI (Python backend API server)")
        if "streamlit" in f:
            detected_frameworks.append("Streamlit (data dashboard)")
            
    detected_frameworks = list(set(detected_frameworks))
    frameworks_str = ", ".join(detected_frameworks) if detected_frameworks else "standard web tools"

    top_langs = [f"{k} ({v} files)" for k, v in list(languages.items())[:3]]
    lang_summary = ", ".join(top_langs) if top_langs else "code files"

    markdown_human = f"""### 1. What Is This Project & Why Does It Exist?
**{name}** is a software project with **{repo_data.get('total_files', 0)} files** and about **{repo_data.get('total_loc', 0):,} lines of code**, mainly built with {lang_summary}.

Think of this project as a friendly, automated tour guide and mapmaker for code. When you open a new codebase, it is easy to feel lost among dozens of files. This tool looks through the entire project and draws visual maps showing exactly how all the parts work together.

### 2. How It Works: The Step-by-Step Story
Here is how the project works behind the scenes in plain English:
- **Step 1: Scanning the Files**: It opens the repository folder and reads each code file, neatly ignoring temporary files or build folders.
- **Step 2: Connecting the Dots**: It finds functions, classes, and imports to figure out which file calls which other file.
- **Step 3: Creating the Interactive View**: It turns those connections into interactive visual diagrams and clear summaries so anyone can navigate the architecture easily.

### 3. The Main Building Blocks (Meet the Team)
Here are some of the key files working together:
"""
    for path, data in list(files.items())[:6]:
        analysis = data.get("analysis", {})
        cls_count = len(analysis.get("classes", []))
        fn_count = len(analysis.get("functions", []))
        filename = path.split("/")[-1]
        markdown_human += f"- **`{filename}`** (`{path}`): Contains {fn_count} functions and {cls_count} classes ({data.get('loc', 0)} lines).\n"

    markdown_human += f"""
### 4. What's Great & A Couple Friendly Tips
- **What's Great**: The codebase neatly separates the frontend interface from the backend analysis engine ({frameworks_str}).
- **Friendly Tip**: Add your Gemini API Key in the top bar to get personalized, in-depth AI answers about any specific function or feature!
"""

    return {
        "is_ai_generated": False,
        "markdown_explanation": markdown_human,
        "high_level_purpose": f"{name} is an automated visual guide and mapmaker for your codebase.",
        "architecture_overview": f"Built with clean separation between interface and analysis services using {frameworks_str}.",
        "key_components": [],
        "note": "AST Heuristic Summary (Add your Gemini API Key in the top bar for deep generative insights)."
    }


def explain_project(repo_data: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    active_key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()

    if not active_key:
        return generate_heuristic_explanation(repo_data)

    skeleton = build_code_skeleton(repo_data)

    prompt = f"""
You are a friendly, encouraging senior developer and human mentor explaining a software project to someone over coffee.
Talk like an actual human explainer using simple, everyday words. Avoid textbook jargon, robotic buzzwords, or stiff academic speak.
If you mention a technical term (like "API", "State", or "Backend"), immediately explain it with a friendly everyday comparison (e.g. "an API is like a waiter carrying an order from your table to the kitchen").

Here is the codebase skeleton and metadata:
{skeleton}

Please explain this project in a warm, engaging, and crystal-clear way using these exact section headers:

### 1. What Is This Project & Why Does It Exist?
Explain what this project actually does in 2-3 friendly, simple sentences. What real-world problem does it solve for someone using it? Include an easy real-life analogy (e.g., "Think of it like...").

### 2. How It Works: The Step-by-Step Story
Walk through what happens from start to finish in plain English.
Tell it like a simple story:
- **Step 1: When a user starts...**: What triggers the action?
- **Step 2: Behind the scenes...**: How data moves and what the computer actually does with it.
- **Step 3: The end result...**: What the user sees or gets back.

### 3. The Main Building Blocks (Meet the Team)
Introduce 3 to 6 of the most important files or components like a team of helpers with specific jobs (e.g., "The Brain", "The Painter/Interface", "The Scanner"):
- For each one, give its file path, a fun role/nickname, and explain its job in one simple sentence.

### 4. What's Great & A Couple Friendly Tips
- Highlight 1-2 things the developer did really well that make this project great.
- Share 1-2 friendly, practical tips or suggestions to make it even easier to work with or extend in the future.

Keep your tone warm, conversational, clear, and human throughout!
"""

    last_err = None

    try:
        client = genai.Client(api_key=active_key)
        for model_name in PREFERRED_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if response and response.text:
                    return {
                        "is_ai_generated": True,
                        "model_used": model_name,
                        "markdown_explanation": response.text,
                        "high_level_purpose": "Human-friendly AI Architectural Analysis",
                        "architecture_overview": response.text[:350] + "...",
                        "key_components": []
                    }
            except Exception as e:
                last_err = e
                continue
    except Exception as e:
        last_err = e

    # Fallback to heuristic
    heuristic = generate_heuristic_explanation(repo_data)
    if last_err:
        heuristic["ai_error"] = str(last_err)
    return heuristic


def _generate_heuristic_flowchart(file_name: str, functions: list, classes: list, ext: str, code: str) -> str:
    """Generate a clean Mermaid flowchart illustrating the logic and control flow."""
    lines = [
        "graph TD",
        "  Start([\"▶ Start / Execution Trigger\"])",
        "  Start --> Init[\"Load Dependencies & Modules\"]"
    ]
    
    prev_node = "Init"
    node_idx = 1

    if classes:
        cls_names = [c.get("name", "Class") for c in classes[:3]]
        lines.append(f"  {prev_node} --> ClassDef[\"Instantiate Class / Object: {', '.join(cls_names)}\"]")
        prev_node = "ClassDef"

    if any(k in code for k in ("fetch(", "axios", "http", "urllib", "requests")):
        node_idx += 1
        n = f"ReqNode{node_idx}"
        lines.append(f"  {prev_node} --> {n}[\"Prepare Network / API Request\"]")
        prev_node = n

    if any(k in code for k in ("if ", "if(", "elif ", "else:", "switch")):
        node_idx += 1
        cond_node = f"Cond{node_idx}"
        val_pass = f"Pass{node_idx}"
        val_fail = f"Fail{node_idx}"
        lines.append(f"  {prev_node} --> {cond_node}{{\"Validate Arguments & Input Conditions\"}}")
        lines.append(f"  {cond_node} -- \"Valid / Matches\" --> {val_pass}[\"Execute Core Algorithm / Transformation\"]")
        lines.append(f"  {cond_node} -- \"Invalid / Missing\" --> {val_fail}[\"Handle Error / Default Fallback\"]")
        prev_node = val_pass
    else:
        node_idx += 1
        n = f"Proc{node_idx}"
        lines.append(f"  {prev_node} --> {n}[\"Process & Transform Data\"]")
        prev_node = n

    if any(k in code for k in ("for ", "for(", "while ", "while(")):
        node_idx += 1
        loop_node = f"Loop{node_idx}"
        lines.append(f"  {prev_node} --> {loop_node}[\"Iterate / Loop Through Items or Records\"]")
        prev_node = loop_node

    if functions:
        fn_names = [f.get("name", "fn") for f in functions[:4] if f.get("name")]
        if fn_names:
            node_idx += 1
            fn_node = f"FnNode{node_idx}"
            lines.append(f"  {prev_node} --> {fn_node}[\"Invoke Handlers: {', '.join(fn_names[:3])}()\"]")
            prev_node = fn_node

    node_idx += 1
    end_node = f"EndNode{node_idx}"
    lines.append(f"  {prev_node} --> {end_node}([\"✔ Return Result / Update UI State\"])")
    
    return "\n".join(lines)


def generate_heuristic_file_explanation(
    file_path: str,
    code: str,
    file_info: Optional[Dict[str, Any]] = None,
    repo_data: Optional[Dict[str, Any]] = None,
    mode: str = "full",
    symbol_name: Optional[str] = None
) -> Dict[str, Any]:
    file_name = file_path.replace("\\", "/").split("/")[-1]
    analysis = (file_info or {}).get("analysis", {})
    classes = analysis.get("classes", [])
    functions = analysis.get("functions", [])
    imports = analysis.get("imports", [])
    loc = len(code.splitlines()) if code else (file_info or {}).get("loc", 0)

    ext = file_name.split(".")[-1].lower() if "." in file_name else ""

    # If user wants a specific symbol explained
    target_fn = None
    target_cls = None
    if symbol_name:
        for f in functions:
            if f.get("name") == symbol_name:
                target_fn = f
                break
        for c in classes:
            if c.get("name") == symbol_name:
                target_cls = c
                break

    sections = []
    
    if symbol_name and (target_fn or target_cls):
        sym_type = "Function" if target_fn else "Class"
        sections.append(f"## 🔍 Deep-Dive: `{symbol_name}` ({sym_type}) in `{file_name}`")
        sections.append(f"> **File:** `{file_path}`  |  **Symbol:** `{symbol_name}`  |  **Type:** {sym_type}")

        sections.append("### 1. 🎯 What Does This Symbol Do?")
        if target_fn:
            args = target_fn.get("args", [])
            args_str = f"({', '.join(args)})" if args else "()"
            sections.append(f"`{symbol_name}{args_str}` performs an operation within `{file_name}`. It accepts {len(args)} parameter(s) and executes targeted calculation, validation, or transformation logic.")
        else:
            methods = [m.get("name") for m in target_cls.get("methods", []) if m.get("name")]
            sections.append(f"`{symbol_name}` is an object blueprint that encapsulates internal state and provides {len(methods)} method(s): `{', '.join(methods[:8]) or 'None'}`.")

        sections.append("### 2. ⚙️ Step-by-Step Execution Sequence")
        sections.append(f"1. **Entry & Invocation**: The caller invokes `{symbol_name}` with the required arguments.")
        sections.append("2. **Input Validation**: Verifies input types, defaults, and boundary conditions.")
        sections.append("3. **Core Computation**: Executes the internal algorithmic statements, loops, or condition checks.")
        sections.append("4. **Return / Outcome**: Yields the computed data structure or mutates target object state.")

        sections.append("### 3. 💡 Everyday Analogy")
        sections.append(f"Think of `{symbol_name}` like a specialized workstation in a factory. Material (inputs) comes in on the conveyor belt, this workstation applies specific tools and adjustments, and sends the finished part (return value) to the next station.")
    else:
        sections.append(f"## 📄 Code & Logic Explainer: `{file_name}`")
        sections.append(f"> **File Path:** `{file_path}`  |  **Lines of Code:** {loc:,} lines  |  **Language:** {ext.upper() or 'Text'}")

        # 1. Purpose / Big Picture
        sections.append("### 1. 🎯 Purpose & Big Picture (Plain English)")
        if ext in ("py", "js", "ts", "jsx", "tsx"):
            if any(k in file_name.lower() for k in ("main", "app", "index")):
                sections.append(f"`{file_name}` serves as the primary hub and entrypoint for this part of the application. Like the conductor of an orchestra, it ensures all components, routes, and background listeners start in harmony.")
            elif "api" in file_name.lower() or "route" in file_name.lower() or "server" in file_name.lower():
                sections.append(f"`{file_name}` manages incoming network communication and API routes. Think of it like a polite front-desk receptionist who greets visitors, checks their credentials, and directs them to the right office.")
            elif "view" in file_name.lower() or "component" in file_name.lower() or "modal" in file_name.lower() or ext in ("jsx", "tsx"):
                sections.append(f"`{file_name}` is a user interface component. It defines what the user sees on the screen, manages interactive state (like clicks, inputs, and modals), and presents data clearly.")
            else:
                sections.append(f"`{file_name}` contains specialized business logic, utility functions, or data transformation algorithms that keep the application modular and maintainable.")
        elif ext == "html":
            sections.append(f"`{file_name}` provides the structural foundation of the webpage. Think of it like the architectural blueprint and walls of a building before the interior paint and furniture are added.")
        elif ext == "css":
            sections.append(f"`{file_name}` handles the styling, colors, dark-mode themes, and layout animations. It turns raw information into a polished, modern, and engaging visual experience.")
        else:
            sections.append(f"`{file_name}` provides project configuration, parameters, or documentation for the environment.")

        # 2. Step-by-Step Logic Flow
        sections.append("### 2. ⚙️ Step-by-Step Logic & Execution Flow")
        sections.append("Here is exactly how the code executes from top to bottom:")
        sections.append("1. **Initialization & Imports**: External packages and internal helper utilities are loaded into memory.")
        if classes:
            sections.append(f"2. **Structure & Model Setup**: Defines {len(classes)} class blueprint(s) ({', '.join(c.get('name', '') for c in classes[:3])}) to organize state.")
        if any(k in code for k in ("fetch(", "axios", "requests", "http", "urllib")):
            sections.append("3. **Network & Asynchronous Handling**: Issues requests to fetch external data or talk with backend servers using asynchronous promises.")
        if any(k in code for k in ("if ", "if(", "switch")):
            sections.append("4. **Decision & Validation Logic**: Evaluates conditions to protect against null/undefined values and decide which code path to execute.")
        if any(k in code for k in ("for ", "while ", "map(", "filter(", "reduce(")):
            sections.append("5. **Data Transformation Loops**: Iterates through collections, filtering or mapping records to the desired output format.")
        sections.append("6. **Output & Return**: Returns the finalized calculations, renders UI elements, or responds to the caller.")

        # 3. Key Functions & Classes
        sections.append("### 3. 🧩 Key Functions & Classes Breakdown")
        if classes:
            sections.append(f"**Classes Defined ({len(classes)}):**")
            for c in classes[:5]:
                methods = [m.get("name") for m in c.get("methods", []) if m.get("name")]
                methods_str = f" | Methods: `{', '.join(methods[:5])}`" if methods else ""
                sections.append(f"- **`class {c.get('name')}`**: Represents a core domain entity{methods_str}.")
        if functions:
            sections.append(f"**Functions Defined ({len(functions)}):**")
            for fn in functions[:10]:
                args = fn.get("args", [])
                args_str = f"({', '.join(args[:4])})" if args else "()"
                doc = fn.get("docstring") or "Executes computational logic and returns the resulting value."
                sections.append(f"- **`{fn.get('name')}{args_str}`**: {doc}")
            if len(functions) > 10:
                sections.append(f"- *...plus {len(functions) - 10} more helper functions.*")

        if not classes and not functions:
            sections.append("This file contains declarations, stylesheet definitions, or sequential script statements.")

        # 4. Everyday Analogy
        sections.append("### 4. 💡 Everyday Analogy (For Quick Understanding)")
        sections.append(f"Imagine a kitchen during dinner service: `{file_name}` is like the station chef who receives raw ingredients (inputs), follows an exact recipe step-by-step (the code logic), checks the temperature and taste (conditionals), and plates the completed dish (return value) for the guest.")

        # 5. Tips & Gotchas
        sections.append("### 5. ⚠️ Key Tips & Things to Keep in Mind")
        sections.append("- **Input Validation**: Always verify required parameters before calling core calculation routines to avoid unexpected exceptions.")
        if ext in ("js", "ts", "jsx", "tsx"):
            sections.append("- **Asynchronous Operations**: When dealing with Promises or network calls, always handle loading and error states to maintain a smooth user experience.")
        elif ext == "py":
            sections.append("- **Error Handling**: Wrap external I/O or parsing operations in `try-except` blocks to handle malformed input gracefully.")

    sections.append("---")
    sections.append("*💡 Tip: Enter your Gemini API Key in the top navigation bar to generate customized, AI-driven line-by-line logic explanations with step-by-step logic tracing.*")

    flowchart = _generate_heuristic_flowchart(file_name, functions, classes, ext, code)

    return {
        "file_path": file_path,
        "is_ai_generated": False,
        "mode": mode,
        "symbol_name": symbol_name,
        "markdown_explanation": "\n\n".join(sections),
        "flowchart_mermaid": flowchart,
        "symbols": {
            "classes": classes,
            "functions": functions,
            "imports": imports
        }
    }


def explain_file_code(
    file_path: str,
    code: str,
    file_info: Optional[Dict[str, Any]] = None,
    repo_data: Optional[Dict[str, Any]] = None,
    mode: str = "full",
    api_key: Optional[str] = None,
    symbol_name: Optional[str] = None
) -> Dict[str, Any]:
    active_key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()

    if not active_key:
        return generate_heuristic_file_explanation(file_path, code, file_info, repo_data, mode, symbol_name)

    file_name = file_path.replace("\\", "/").split("/")[-1]
    repo_name = (repo_data or {}).get("repo_name", "the project")
    code_snippet = code[:35000] if len(code) > 35000 else code

    mode_prompts = {
        "logic": (
            "Focus primarily on the algorithmic logic, step-by-step execution flow, state variables, "
            "conditional branches, loops, and data transformations. Explain what happens sequentially when this code runs."
        ),
        "functions": (
            "Provide an in-depth breakdown of every function, class, and method defined in this file. "
            "For each function: explain what parameters it takes, its core logic, its return value, and any side effects."
        ),
        "beginner": (
            "Explain this file in an extremely beginner-friendly way using simple everyday analogies (like cooking recipes, cars, or restaurants). "
            "Avoid intimidating jargon. If you use a technical word, explain it simply immediately. Make it enjoyable and easy for someone learning code."
        ),
        "flowchart": (
            "Focus heavily on the decision logic and control flow. Provide a clear step-by-step logic trace and include a detailed Mermaid flowchart diagram."
        ),
        "full": (
            "Provide a comprehensive, crystal-clear explanation covering its architectural purpose, step-by-step logic flow, "
            "key functions and classes, variables and state management, and critical edge cases or gotchas."
        )
    }

    selected_mode_instruction = mode_prompts.get(mode, mode_prompts["full"])
    symbol_focus_instruction = f"IMPORTANT: Focus specifically on the symbol `{symbol_name}` within this code, explaining its parameters, internal logic, and purpose." if symbol_name else ""

    prompt = f"""
You are an expert software engineer, architecture mentor, and coding educator.
Your task is to explain the following source code file from the project **"{repo_name}"** so the user can easily understand the code, its logic, and how it works.

File Name: `{file_name}`
File Path: `{file_path}`
Mode: {mode.upper()}
{symbol_focus_instruction}

Code Content:
```
{code_snippet}
```

Instructions:
{selected_mode_instruction}

Please structure your explanation in clean, beautifully formatted Markdown with these clear sections:

## 📄 Code & Logic Explainer: `{file_name}`

### 1. 🎯 Purpose & Big Picture (Plain English)
Explain in 2-3 clear, friendly sentences what this code does, why it exists in {repo_name}, and what real-world problem it solves. Include a relatable everyday analogy.

### 2. ⚙️ Step-by-Step Logic & Execution Flow
Explain the sequence of execution when this code runs:
- **Initialization / Setup**: What happens when the file or routine is first invoked.
- **Data Flow & Logic Steps**: Trace how data, user inputs, or events move through this code from start to finish.
- **State & Variables**: Highlight key variables, state properties, or data structures and how their values change.

### 3. 🧩 Key Functions, Classes & Handlers
Break down the important functions, classes, or event handlers in this code:
- For each one, explain: **What it does**, **inputs/parameters**, **how its logic works**, and **what it returns or updates**.

### 4. 📊 Visual Control Flow (Mermaid Diagram)
Provide a clean Mermaid flowchart diagram (`graph TD` or `flowchart TD`) visually diagramming the logic paths, decision branches, and return points. Ensure it is enclosed in standard ```mermaid ... ``` code fences.

### 5. 💡 Key Insights, Gotchas & Complexity
Share 1-2 important design decisions, edge cases (e.g. empty inputs, network errors), time/space complexity if applicable, and practical tips when working with this code.

Keep your tone engaging, precise, clear, and easy to understand! Use backticks for variable names and functions.
"""

    last_err = None
    try:
        client = genai.Client(api_key=active_key)
        for model_name in PREFERRED_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if response and response.text:
                    resp_text = response.text

                    # Extract Mermaid diagram if present in response
                    import re
                    mermaid_match = re.search(r'```mermaid\s*([\s\S]*?)\s*```', resp_text)
                    flowchart = mermaid_match.group(1).strip() if mermaid_match else None

                    analysis = (file_info or {}).get("analysis", {})
                    return {
                        "file_path": file_path,
                        "is_ai_generated": True,
                        "model_used": model_name,
                        "mode": mode,
                        "symbol_name": symbol_name,
                        "markdown_explanation": resp_text,
                        "flowchart_mermaid": flowchart or _generate_heuristic_flowchart(
                            file_name,
                            analysis.get("functions", []),
                            analysis.get("classes", []),
                            file_name.split(".")[-1].lower() if "." in file_name else "",
                            code
                        ),
                        "symbols": {
                            "classes": analysis.get("classes", []),
                            "functions": analysis.get("functions", []),
                            "imports": analysis.get("imports", [])
                        }
                    }
            except Exception as e:
                last_err = e
                continue
    except Exception as e:
        last_err = e

    fallback = generate_heuristic_file_explanation(file_path, code, file_info, repo_data, mode, symbol_name)
    if last_err:
        fallback["ai_error"] = str(last_err)
    return fallback

