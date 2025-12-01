#!/usr/bin/env python3
# run_classifier.py
# Robust bank statement classifier runner with per-file error handling

import os
import sys
import json
import shutil
import hashlib
import traceback
from typing import List, Dict, Any

# ---- CONFIG ----
processed_db_filename = "processed_db.json"
# ----------------

def ensure_dir(p: str):
    if not p:
        return
    os.makedirs(p, exist_ok=True)

def abs_path(p: str) -> str:
    return os.path.abspath(p)

def sha256_of_file(path: str, chunk_size: int = 8192) -> str:
    """Compute SHA256 checksum of file for duplicate prevention."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

def unique_dest_path(dst_dir: str, base_name: str) -> str:
    """Ensure destination file name is unique."""
    ensure_dir(dst_dir)
    dst = os.path.join(dst_dir, base_name)
    if not os.path.exists(dst):
        return dst
    name, ext = os.path.splitext(base_name)
    i = 1
    while True:
        cand = os.path.join(dst_dir, f"{name}_{i}{ext}")
        if not os.path.exists(cand):
            return cand
        i += 1

def safe_move(src: str, dst_dir: str) -> str:
    """Move src file to dst_dir without overwrite."""
    base = os.path.basename(src)
    dst = unique_dest_path(dst_dir, base)
    shutil.move(src, dst)
    return os.path.abspath(dst)

def load_processed_db(db_path: str) -> Dict[str, Any]:
    """Load or initialize the processed file database."""
    if os.path.exists(db_path):
        try:
            with open(db_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            try:
                shutil.copy2(db_path, db_path + ".bak")
            except Exception:
                pass
    return {"files": {}}

def save_processed_db(db_path: str, db: Dict[str, Any]):
    """Save the processed DB safely."""
    ensure_dir(os.path.dirname(db_path))
    tmp = db_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)
    os.replace(tmp, db_path)

# ---- import classifier ----
try:
    import classifier
except Exception as e:
    print(json.dumps({"error": "cannot_import_classifier", "detail": str(e)}))
    sys.exit(2)

if not hasattr(classifier, "classify_files") or not callable(getattr(classifier, "classify_files")):
    print(json.dumps({
        "error": "missing_classify_function",
        "detail": "Expected classifier.classify_files(list_of_paths)"
    }))
    sys.exit(2)

def _determine_is_bank(result_item: Any) -> bool:
    """
    Robust detection of whether classifier says this is a bank statement.
    Accepts dict with various keys, numeric flags, boolean values, or strings.
    """
    try:
        if isinstance(result_item, bool):
            return result_item
        if isinstance(result_item, (int, float)):
            return bool(result_item)
        if isinstance(result_item, dict):
            for key in ("is_bank_statement", "is_bank", "bank_statement", "is_bankstmt", "is_bank_statement_flag"):
                if key in result_item:
                    v = result_item[key]
                    if isinstance(v, bool):
                        return v
                    if isinstance(v, (int, float)):
                        return bool(v)
                    if isinstance(v, str):
                        if v.strip().lower() in ("1", "true", "yes", "y", "t"):
                            return True
                        return False
            for key in ("label", "pred", "prediction"):
                if key in result_item:
                    v = result_item[key]
                    if isinstance(v, str) and v.strip().lower() in ("bank", "bank_statement", "statement", "yes"):
                        return True
                    if isinstance(v, (int, float)):
                        return bool(v)
            return False
        if isinstance(result_item, str):
            if result_item.strip().lower() in ("1", "true", "yes", "bank", "bank_statement"):
                return True
            return False
    except Exception:
        return False
    return False

def process_single(file_path: str, unprocessed_dir: str, rejected_dir: str,
                   processed_db: Dict[str, Any], db_path: str) -> Dict[str, Any]:
    """Classify and move one file based on result."""
    file_path = abs_path(file_path)
    result = {
        "file_path": file_path,
        "is_bank_statement": False,
        "moved_to": None,
        "error": None,
        "skipped": False
    }

    if not os.path.exists(file_path):
        result["error"] = "file_not_found"
        print(json.dumps(result)); sys.stdout.flush(); return result

    # Compute hash for duplicate prevention
    try:
        file_hash = sha256_of_file(file_path)
    except Exception as e:
        result["error"] = f"hash_error: {e}"
        print(json.dumps(result)); sys.stdout.flush(); return result

    # Skip if already processed
    if file_hash in processed_db.get("files", {}):
        result["skipped"] = True
        result["reason"] = "already_processed"
        print(json.dumps(result)); sys.stdout.flush(); return result

    # Classify the file
    try:
        results = classifier.classify_files([file_path])
    except Exception as e:
        try:
            moved = safe_move(file_path, rejected_dir)
            result["moved_to"] = moved
            result["status"] = "classifier_exception -> moved_to_rejected"
        except Exception as me:
            result["error"] = f"classifier_exception_and_move_failed: {e} | move_err: {me}"
            print(json.dumps(result)); sys.stdout.flush(); return result

        result["error"] = f"classifier_exception: {str(e)}"
        processed_db["files"][file_hash] = {
            "original_name": os.path.basename(file_path),
            "is_bank_statement": False,
            "moved_to": result.get("moved_to"),
            "error": result["error"],
            "timestamp": int(__import__("time").time())
        }
        save_processed_db(db_path, processed_db)
        print(json.dumps(result)); sys.stdout.flush(); return result

    if not isinstance(results, list) or len(results) == 0:
        try:
            moved = safe_move(file_path, rejected_dir)
            result["moved_to"] = moved
            result["status"] = "no_results_from_classifier -> moved_to_rejected"
            result["error"] = "no_results_from_classifier"
        except Exception as e:
            result["error"] = f"no_results_and_move_failed: {e}"
            print(json.dumps(result)); sys.stdout.flush(); return result

        processed_db["files"][file_hash] = {
            "original_name": os.path.basename(file_path),
            "is_bank_statement": False,
            "moved_to": result.get("moved_to"),
            "error": result["error"],
            "timestamp": int(__import__("time").time())
        }
        save_processed_db(db_path, processed_db)
        print(json.dumps(result)); sys.stdout.flush(); return result

    r = results[0]
    is_bank = _determine_is_bank(r)
    result["is_bank_statement"] = is_bank

    try:
        if is_bank:
            moved = safe_move(file_path, unprocessed_dir)
            result["moved_to"] = moved
            result["status"] = "bank_statement -> moved_to_unprocessed"
        else:
            moved = safe_move(file_path, rejected_dir)
            result["moved_to"] = moved
            result["status"] = "not_bank_statement -> moved_to_rejected"
    except Exception as e:
        result["error"] = f"move_error: {e}"

    processed_db["files"][file_hash] = {
        "original_name": os.path.basename(file_path),
        "is_bank_statement": bool(is_bank),
        "moved_to": result.get("moved_to"),
        "error": result.get("error"),
        "timestamp": int(__import__("time").time())
    }
    try:
        save_processed_db(db_path, processed_db)
    except Exception as e:
        result["db_save_error"] = str(e)

    print(json.dumps(result)); sys.stdout.flush()
    return result

def process_batch(files: List[str], unprocessed_dir: str, rejected_dir: str,
                  processed_db: Dict[str, Any], db_path: str):
    """Process all files in batch (one by one). Keep running even on individual errors."""
    files_sorted = sorted(files)
    for f in files_sorted:
        try:
            process_single(f, unprocessed_dir, rejected_dir, processed_db, db_path)
        except Exception as e:
            print(json.dumps({
                "file_path": abs_path(f),
                "error": f"unhandled_exception_in_process_batch: {str(e)}",
                "trace": traceback.format_exc()
            }))
            sys.stdout.flush()

def main(argv):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(script_dir, "input")
    output_root = os.path.join(script_dir, "output")
    unprocessed_dir = os.path.join(output_root, "unprocessed")
    rejected_dir = os.path.join(output_root, "rejected")
    db_path = os.path.join(output_root, processed_db_filename)

    ensure_dir(input_dir)
    ensure_dir(unprocessed_dir)
    ensure_dir(rejected_dir)

    processed_db = load_processed_db(db_path)

    if len(argv) == 0:
        target = input_dir
    else:
        target = argv[0]
    target = abs_path(target)

    if os.path.isfile(target):
        process_single(target, unprocessed_dir, rejected_dir, processed_db, db_path)
        return

    if os.path.isdir(target):
        files = [os.path.join(target, f) for f in os.listdir(target)
                 if os.path.isfile(os.path.join(target, f))]
        if not files:
            print(json.dumps({"info": f"No files found in {target}"}))
            return
        process_batch(files, unprocessed_dir, rejected_dir, processed_db, db_path)
        return

    print(json.dumps({"error": "invalid_target", "detail": target}))

if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception as e:
        print(json.dumps({
            "error": f"Unhandled exception in run_classifier: {str(e)}",
            "trace": traceback.format_exc()
        }))
        sys.exit(2)
