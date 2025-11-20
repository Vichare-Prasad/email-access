#!/usr/bin/env python3
# generate_report.py
import sys
import os
import json
import hashlib
from pathlib import Path

try:
    import pandas as pd
except Exception:
    print(json.dumps({"error":"missing_dependency","detail":"pandas required. pip install pandas openpyxl xlsxwriter"}))
    sys.exit(2)

def sha256_of_file(p):
    h = hashlib.sha256()
    with open(p,"rb") as f:
        while True:
            b = f.read(8192)
            if not b: break
            h.update(b)
    return h.hexdigest()

def gather_from_dir(dirpath):
    out = []
    p = Path(dirpath)
    if not p.exists():
        return out
    for f in sorted(p.iterdir()):
        if f.is_file():
            try:
                st = f.stat()
                out.append({
                    "filename": str(f.name),
                    "path": str(f.resolve()),
                    "size": int(st.st_size),
                    "sha256": sha256_of_file(str(f))
                })
            except Exception as e:
                out.append({"filename": f.name, "error": str(e)})
    return out

def gather_from_list(lst):
    out = []
    for item in lst:
        p = Path(item)
        if p.exists() and p.is_file():
            try:
                st = p.stat()
                out.append({
                    "filename": str(p.name),
                    "path": str(p.resolve()),
                    "size": int(st.st_size),
                    "sha256": sha256_of_file(str(p))
                })
            except Exception as e:
                out.append({"filename": p.name, "error": str(e)})
        else:
            out.append({"filename": str(item), "error": "not_found"})
    return out

def main():
    args = sys.argv[1:]
    outdir = Path("output")
    outdir.mkdir(parents=True, exist_ok=True)
    rows = []
    if len(args) == 0:
        # no args -> use output/unprocessed
        rows = gather_from_dir(Path("output") / "unprocessed")
    elif len(args) == 1 and args[0] == "--stdin-json":
        # read JSON list from stdin
        txt = sys.stdin.read()
        try:
            lst = json.loads(txt)
        except Exception as e:
            print(json.dumps({"error":"invalid_stdin_json","detail":str(e)}))
            sys.exit(2)
        rows = gather_from_list(lst)
    else:
        # args given as a single directory or list of files
        if len(args) == 1 and os.path.isdir(args[0]):
            rows = gather_from_dir(args[0])
        else:
            rows = gather_from_list(args)

    if not rows:
        print(json.dumps({"info":"no_files","count":0}))
        return

    df = pd.DataFrame(rows)
    report_path = outdir / "report.xlsx"
    try:
        df.to_excel(report_path, index=False)
        print(json.dumps({"ok":True,"report":str(report_path),"count":len(rows)}))
    except Exception as e:
        print(json.dumps({"error":"write_failed","detail":str(e)}))
        sys.exit(2)

if __name__ == "__main__":
    main()
