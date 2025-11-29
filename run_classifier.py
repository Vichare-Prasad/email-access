# import os
# import sys
# import json
# import shutil
# from classifier import classify_files

# def classify_folder(input_folder, output_folder):
#     """
#     Classify all files in input_folder and move bank statements to output_folder/unprocessed/
#     """
#     try:
#         # Create unprocessed folder inside output
#         unprocessed_folder = os.path.join(output_folder, "unprocessed")
#         os.makedirs(unprocessed_folder, exist_ok=True)
        
#         print(f"📁 Input folder: {input_folder}")
#         print(f"📁 Output folder: {output_folder}")
#         print(f"📁 Unprocessed folder: {unprocessed_folder}")

#         # Check if input folder exists and has files
#         if not os.path.exists(input_folder):
#             print(f"❌ Input folder does not exist: {input_folder}")
#             return []
            
#         files_in_input = os.listdir(input_folder)
#         print(f"📄 Files found in input: {files_in_input}")

#         # Collect all files from the input folder
#         file_paths = [
#             os.path.join(input_folder, f)
#             for f in files_in_input
#             if os.path.isfile(os.path.join(input_folder, f))
#         ]

#         if not file_paths:
#             print("ℹ️ No files found to process")
#             return []

#         print(f"🔍 Processing {len(file_paths)} files...")

#         # Step 1: Run bank statement classification
#         results = classify_files(file_paths)
#         print(f"🎯 Classification completed for {len(results)} files")

#         # Step 2: Copy bank statements to unprocessed folder
#         bank_statements_found = 0
#         for result in results:
#             src = result["file_path"]
#             file_name = os.path.basename(src)

#             if result.get("is_bank_statement", False):
#                 dst = os.path.join(unprocessed_folder, file_name)
#                 try:
#                     shutil.copy2(src, dst)
#                     bank_statements_found += 1
#                     print(f"✅ {file_name} → Bank Statement (copied to {unprocessed_folder})")
#                 except Exception as copy_error:
#                     print(f"❌ Failed to copy {file_name}: {copy_error}")
#             else:
#                 print(f"❌ {file_name} → Not a Bank Statement (skipped)")

#         print(f"📊 Summary: {bank_statements_found} bank statements found and copied")
#         return results

#     except Exception as e:
#         print(f"💥 Error in classify_folder: {e}")
#         return []

# def classify_single_file(file_path):
#     """Classify a single file and return result as JSON"""
#     try:
#         print(f"🔍 Classifying single file: {file_path}")
        
#         # Convert to absolute path and normalize
#         file_path = os.path.abspath(file_path)
#         print(f"📁 Absolute path: {file_path}")
        
#         if not os.path.exists(file_path):
#             error_msg = f"File not found: {file_path}"
#             print(f"❌ {error_msg}")
#             return {"error": error_msg, "status": "error"}
            
#         # Get file info
#         file_size = os.path.getsize(file_path)
#         print(f"📊 File size: {file_size} bytes")
        
#         # Run classification
#         results = classify_files([file_path])
        
#         if results and len(results) > 0:
#             result = results[0]
#             classification_result = {
#                 "path": result["file_path"],
#                 "is_bank_statement": result.get("is_bank_statement", False),
#                 "bank_name": result.get("bank_name", "Unknown"),
#                 "confidence": result.get("confidence_score", 0),
#                 "status": "success"
#             }
            
#             print(f"✅ Classification result: {classification_result}")
            
#             # If it's a bank statement, copy it to unprocessed folder
#             if classification_result["is_bank_statement"]:
#                 try:
#                     if output_folder_override:
#                         output_dir = output_folder_override
#                     else:
#                     # existing fallback behavior
#                         input_dir = os.path.dirname(file_path)
#                         base_dir = os.path.dirname(input_dir)
#                         output_dir = os.path.join(base_dir, "output", "unprocessed")
#             # os.makedirs(output_dir, exist_ok=True)
#             # dst_path = os.path.join(output_dir, os.path.basename(file_path))
#             # shutil.copy2(file_path, dst_path)

#                     # Determine output directory (same as input but in output folder)
#                     script_dir = os.path.dirname(os.path.abspath(__file__))   # project root/run_classifier.py location
#                     project_root = os.path.abspath(os.path.join(script_dir))   # adjust if run_classifier.py is in project root
#                     output_dir = os.path.join(project_root, "output", "unprocessed")
#                     os.makedirs(output_dir, exist_ok=True)
                    
#                     dst_path = os.path.join(output_dir, os.path.basename(file_path))
#                     shutil.copy2(file_path, dst_path)
#                     print(f"🏦 Bank statement copied to: {dst_path}")
#                     classification_result["output_path"] = dst_path
#                 except Exception as copy_error:
#                     print(f"❌ Failed to copy bank statement: {copy_error}")
#                     classification_result["copy_error"] = str(copy_error)
            
#             return classification_result
            
#         return {"error": "No classification result", "status": "error"}
        
#     except Exception as e:
#         error_msg = f"Classification error: {str(e)}"
#         print(f"❌ {error_msg}")
#         return {"error": error_msg, "status": "error"}

# if __name__ == "__main__":
#     print("🚀 Starting bank statement classifier...")
#     print(f"📁 Current working directory: {os.getcwd()}")
#     print(f"📂 Script directory: {os.path.dirname(os.path.abspath(__file__))}")
    
#     # Case 1: Single file path provided as argument
#     # if len(sys.argv) > 1:
#     #     file_path = sys.argv[1]
#     #     print(f"📥 Received file path: {file_path}")
        
#     #     result = classify_single_file(file_path)
#     #     print(json.dumps(result, indent=2))

#     # At top of __main__ where args are parsed:
#     if len(sys.argv) > 1:
#         file_path = sys.argv[1]
#         # optionally get output folder from arg[2]
#         output_arg = sys.argv[2] if len(sys.argv) > 2 else None
#         if output_arg:
#             # ensure it's an absolute path
#             output_folder_for_file = os.path.abspath(output_arg)
#         else:
#             output_folder_for_file = None

#     # change call to classify_single_file to accept output_folder_for_file
#         result = classify_single_file(file_path, output_folder_for_file)
#         print(json.dumps(result, indent=2))

    
#     # Case 2: No arguments - process entire input folder
#     else:
#         print("🔄 No arguments provided, processing input folder...")
        
#         # Try to find input folder relative to script location
#         # Use the main project output folder (not inside storage)
#         input_dir = os.path.dirname(os.path.abspath(__file__))
#         output_dir = os.path.join(input_dir, "output", "unprocessed")
#         os.makedirs(output_dir, exist_ok=True)

        
#         print(f"🔍 Looking for input folder: {input_dir}")
        
#         # Create input folder if it doesn't exist
#         os.makedirs(input_dir, exist_ok=True)
        
#         results = classify_folder(input_dir, output_dir)
#         print(f"\n📊 Final    :")
#         for result in results:
#             status = "✅ Bank Statement" if result.get("is_bank_statement") else "❌ Not Bank Statement"
#             print(f"  {os.path.basename(result['file_path'])}: {status}")










#!/usr/bin/env python3
"""
run_classifier.py

Usage:
  python run_classifier.py <file_path> [<unprocessed_output_dir>]
  python run_classifier.py                    # scans storage/input/ and processes files

Behavior:
 - If run with a file path, classify that single file.
 - If run without args, looks for 'storage/input' under the project root (script dir parent)
   and processes all files inside it.
 - If an optional second argument is provided, it's used as the target 'output/unprocessed'
   directory (absolute or relative path). Otherwise the script writes to:
     <project_root>/output/unprocessed
   Rejected files are saved to:
     <project_root>/output/rejected
 - Emits a JSON object to stdout for each processed file:
   { "is_bank_statement": bool, "input_path": "...", "output_path": "...", "reason": "...", "error": "..." }

Note:
 - This script expects there to be a `classifier.py` module (in the same project) with a callable
   function that can accept a file path and return a boolean or a dict-like result. The script
   tries common function names (.classify, .classify_file, .predict). If none found, it will
   fallback and mark the file as "not classified" and move to rejected.
"""

# from __future__ import annotations
# import sys
# import os
# import json
# import shutil
# import traceback
# from typing import Optional, Dict, Any

# # -----------------------
# # Helper utilities
# # -----------------------
# def project_root_from_script() -> str:
#     """
#     Determine project root relative to this script file.
#     Assumes run_classifier.py lives in the project root. If your layout differs,
#     adjust this function accordingly.
#     """
#     script_dir = os.path.dirname(os.path.abspath(__file__))
#     return script_dir  # change if run_classifier.py is inside subfolder

# def ensure_dir(path: str) -> None:
#     os.makedirs(path, exist_ok=True)

# def load_classifier_module():
#     """
#     Try to import the local classifier module. Returns the module or raises ImportError.
#     """
#     try:
#         import classifier as classifier_mod
#         return classifier_mod
#     except Exception as e:
#         # raise ImportError with message
#         raise ImportError(f"Could not import 'classifier' module: {e}")

# def run_classifier_on_file(classifier_mod, file_path: str) -> Dict[str, Any]:
#     """
#     Adaptively call a classifier function from classifier_mod.
#     Expected return values:
#       - boolean True/False (True = bank statement)
#       - dict-like object with key 'is_bank_statement' or 'score' etc.
#     This function will normalize to a dict with at least 'is_bank_statement' boolean and
#     optional 'meta' dictionary.
#     """
#     candidates = ["classify_file", "classify", "predict", "is_bank_statement", "run"]
#     last_exc = None
#     for name in candidates:
#         func = getattr(classifier_mod, name, None)
#         if callable(func):
#             try:
#                 res = func(file_path)
#                 # Normalize results:
#                 if isinstance(res, bool):
#                     return {"is_bank_statement": bool(res), "meta": None}
#                 if isinstance(res, dict):
#                     # common key names to check
#                     if "is_bank_statement" in res:
#                         return {"is_bank_statement": bool(res.get("is_bank_statement")), "meta": res}
#                     if "is_bank" in res:
#                         return {"is_bank_statement": bool(res.get("is_bank")), "meta": res}
#                     if "score" in res:
#                         # threshold decision: assume score >= 0.5 -> bank
#                         score = float(res.get("score", 0))
#                         return {"is_bank_statement": score >= 0.5, "meta": res}
#                     # fallback: if dict doesn't contain expected keys, treat dict as meta and require user to interpret
#                     return {"is_bank_statement": bool(res.get("is_bank_statement", False)), "meta": res}
#                 # if function returns something else, try to coerce:
#                 if isinstance(res, (int, float)):
#                     return {"is_bank_statement": bool(res), "meta": {"raw": res}}
#                 # unknown return type; continue trying other candidate names
#             except Exception as exc:
#                 last_exc = exc
#                 # continue trying other function names
#     # If we reach here, classifier module had no compatible callable or all failed
#     raise RuntimeError(f"No compatible classifier function worked. Last exception: {last_exc}")

# def copy_to_output(input_path: str, output_dir: str) -> str:
#     ensure_dir(output_dir)
#     filename = os.path.basename(input_path)
#     dst = os.path.join(output_dir, filename)
#     # If destination exists, avoid overwrite by appending a suffix
#     if os.path.exists(dst):
#         base, ext = os.path.splitext(filename)
#         i = 1
#         while True:
#             candidate = os.path.join(output_dir, f"{base}_{i}{ext}")
#             if not os.path.exists(candidate):
#                 dst = candidate
#                 break
#             i += 1
#     shutil.copy2(input_path, dst)
#     return dst

# def process_single_file(file_path: str, unprocessed_override: Optional[str] = None) -> Dict[str, Any]:
#     """
#     Process a single file. Returns the result dict (suitable for json.dumps).
#     """
#     result: Dict[str, Any] = {
#         "input_path": os.path.abspath(file_path),
#         "is_bank_statement": False,
#         "output_path": None,
#         "reason": None,
#         "error": None,
#         "meta": None,
#     }

#     # Basic file existence check
#     if not os.path.exists(file_path):
#         result["error"] = f"Input file does not exist: {file_path}"
#         return result

#     # Determine output directories
#     proj_root = project_root_from_script()
#     default_unprocessed = os.path.join(proj_root, "output", "unprocessed")
#     default_rejected = os.path.join(proj_root, "output", "rejected")

#     unprocessed_dir = os.path.abspath(unprocessed_override) if unprocessed_override else default_unprocessed
#     rejected_dir = default_rejected

#     # Try to load classifier
#     try:
#         classifier_mod = load_classifier_module()
#     except Exception as e:
#         # If classifier module can't be imported, mark as error and put file to rejected
#         result["error"] = f"Classifier import error: {e}"
#         try:
#             out = copy_to_output(file_path, rejected_dir)
#             result["output_path"] = out
#             result["reason"] = "classifier_import_failed -> moved to rejected"
#         except Exception as e2:
#             result["error"] += f"; Also failed to copy to rejected: {e2}"
#         return result

#     # Run classifier
#     try:
#         classification = run_classifier_on_file(classifier_mod, file_path)
#         result["meta"] = classification.get("meta")
#         is_bank = bool(classification.get("is_bank_statement", False))
#         result["is_bank_statement"] = is_bank
#         if is_bank:
#             # Save to unprocessed
#             out = copy_to_output(file_path, unprocessed_dir)
#             result["output_path"] = out
#             result["reason"] = "matched_bank_statement -> moved to unprocessed"
#         else:
#             # Save to rejected
#             out = copy_to_output(file_path, rejected_dir)
#             result["output_path"] = out
#             result["reason"] = "did_not_match -> moved to rejected"
#     except Exception as e:
#         # Classifier execution failure
#         result["error"] = f"Classifier runtime error: {e}\n{traceback.format_exc()}"
#         try:
#             out = copy_to_output(file_path, rejected_dir)
#             result["output_path"] = out
#             result["reason"] = "classifier_runtime_failed -> moved to rejected"
#         except Exception as e2:
#             result["error"] += f"; Also failed to copy to rejected: {e2}"

#     return result

# # -----------------------
# # CLI entrypoint
# # -----------------------
# def main(argv):
#     """
#     main(argv):
#       argv: sys.argv[1:]
#     """
#     if len(argv) == 0:
#         # No args: scan storage/input under project root
#         proj_root = project_root_from_script()
#         storage_input = os.path.join(proj_root, "storage", "input")
#         if not os.path.isdir(storage_input):
#             # If storage/input doesn't exist, fallback to a local 'input' folder
#             storage_input = os.path.join(proj_root, "input")
#         if not os.path.isdir(storage_input):
#             print(json.dumps({"error": f"No input folder found. Checked: 'storage/input' and 'input' under {proj_root}"}))
#             return 1

#         files = []
#         for entry in os.listdir(storage_input):
#             full = os.path.join(storage_input, entry)
#             if os.path.isfile(full):
#                 files.append(full)

#         if not files:
#             print(json.dumps({"info": f"No files to process in {storage_input}"}))
#             return 0

#         results = []
#         for f in files:
#             res = process_single_file(f, unprocessed_override=None)
#             # For bulk runs, print each JSON on its own line so callers can stream/parse them
#             print(json.dumps(res))
#             results.append(res)
#         return 0

#     # If we have at least one arg: treat as single-file run
#     file_path = argv[0]
#     unprocessed_override = argv[1] if len(argv) > 1 else None

#     res = process_single_file(file_path, unprocessed_override=unprocessed_override)
#     # Print a single JSON object for server consumption
#     print(json.dumps(res))
#     return 0

# if __name__ == "__main__":
#     try:
#         exit_code = main(sys.argv[1:])
#         sys.exit(exit_code if isinstance(exit_code, int) else 0)
#     except Exception as e:
#         # Print a last-resort JSON error
#         print(json.dumps({"error": f"Unhandled exception in run_classifier: {e}", "trace": traceback.format_exc()}))
#         sys.exit(2)


#!/usr/bin/env python3
"""
Strict runner that delegates classification to classifier.classify_files(file_paths).

Usage:
  python run_classifier.py <file_or_dir> [<unprocessed_folder>]

Behavior:
  - If <file_or_dir> is a file: calls classifier.classify_files([file]) and prints a single JSON result.
  - If <file_or_dir> is a directory: lists files (non-recursive), calls classifier.classify_files(list_of_files)
    and prints one JSON per file (newline separated).
  - Copies files with is_bank_statement == True into <unprocessed_folder> (created if missing).
  - Exits with code 2 on fatal errors (missing classifier, bad return, missing args).
"""


#!/usr/bin/env python3
"""
run_classifier.py

Usage:
  python run_classifier.py [<file_or_dir>] [<unprocessed_folder>]

Behaviour:
 - If no arguments are provided:
      target -> ./input  (script-dir relative)
      unprocessed_folder -> ./output/unprocessed
 - If first arg is a file: calls classifier.classify_files([file]) and prints a single JSON result.
 - If first arg is a directory: lists files (non-recursive), calls classifier.classify_files(list_of_files)
   and prints one JSON per file (newline separated).
 - Copies files flagged as bank statements into <unprocessed_folder> (created if missing).
 - Prints JSON objects (one per file) to stdout so the caller can parse them.
"""
#!/usr/bin/env python3
"""
run_classifier.py

Improved runner that:
 - Skips files already processed (tracked by SHA256 in processed_db.json)
 - Moves the original file to output/processed/ after processing (so re-runs won't reprocess)
 - Copies bank statements to output/unprocessed/ and rejects to output/rejected/
 - Prints a JSON object per-file to stdout (one line per file) for caller consumption

Usage:
  python run_classifier.py [<file_or_dir>] [<unprocessed_folder>]

Defaults:
  target -> ./input
  unprocessed_folder -> ./output/unprocessed
  processed DB -> ./output/processed/processed_db.json

Change `move_originals` variable below to False if you prefer to keep originals in the input folder.
"""

#!/usr/bin/env python3
"""
run_classifier.py

Behavior (important change):
 - If file classified as bank statement:
     - copy -> ./output/unprocessed/  (safe copy with suffix to avoid overwrite)
     - move original -> ./output/unprocessed/  (keeps input folder clean; original moved into unprocessed)
 - If file NOT bank:
     - copy -> ./output/rejected/
     - move original -> ./output/processed/
 - Files already seen (by SHA256) are skipped.

Usage:
  python run_classifier.py [<file_or_dir>] [<unprocessed_folder>]
"""


#!/usr/bin/env python3
"""
run_classifier.py

Behavior:
 - If classifier marks file as bank statement -> move to ./output/unprocessed/
 - If not a bank statement -> move to ./output/rejected/
 - Never duplicates (only move, no copy)
 - Prevents reprocessing by SHA256 hash (stored in ./output/processed_db.json)
"""

# import os
# import sys
# import json
# import shutil
# import hashlib
# import traceback
# from typing import List, Dict, Any

# # ---- CONFIG ----
# processed_db_filename = "processed_db.json"
# # ----------------

# def ensure_dir(p: str):
#     os.makedirs(p, exist_ok=True)

# def abs_path(p: str) -> str:
#     return os.path.abspath(p)

# def sha256_of_file(path: str, chunk_size: int = 8192) -> str:
#     """Compute SHA256 checksum of file for duplicate prevention."""
#     h = hashlib.sha256()
#     with open(path, "rb") as f:
#         while chunk := f.read(chunk_size):
#             h.update(chunk)
#     return h.hexdigest()

# def unique_dest_path(dst_dir: str, base_name: str) -> str:
#     """Ensure destination file name is unique."""
#     ensure_dir(dst_dir)
#     dst = os.path.join(dst_dir, base_name)
#     if not os.path.exists(dst):
#         return dst
#     name, ext = os.path.splitext(base_name)
#     i = 1
#     while True:
#         cand = os.path.join(dst_dir, f"{name}_{i}{ext}")
#         if not os.path.exists(cand):
#             return cand
#         i += 1

# def safe_move(src: str, dst_dir: str) -> str:
#     """Move src file to dst_dir without overwrite."""
#     base = os.path.basename(src)
#     dst = unique_dest_path(dst_dir, base)
#     shutil.move(src, dst)
#     return os.path.abspath(dst)

# def load_processed_db(db_path: str) -> Dict[str, Any]:
#     """Load or initialize the processed file database."""
#     if os.path.exists(db_path):
#         try:
#             with open(db_path, "r", encoding="utf-8") as f:
#                 return json.load(f)
#         except Exception:
#             # backup corrupted file and start new
#             try:
#                 shutil.copy2(db_path, db_path + ".bak")
#             except Exception:
#                 pass
#     return {"files": {}}

# def save_processed_db(db_path: str, db: Dict[str, Any]):
#     """Save the processed DB safely."""
#     ensure_dir(os.path.dirname(db_path))
#     tmp = db_path + ".tmp"
#     with open(tmp, "w", encoding="utf-8") as f:
#         json.dump(db, f, indent=2)
#     os.replace(tmp, db_path)

# # ---- import classifier ----
# try:
#     import classifier
# except Exception as e:
#     print(json.dumps({"error": "cannot_import_classifier", "detail": str(e)}))
#     sys.exit(2)

# if not hasattr(classifier, "classify_files") or not callable(getattr(classifier, "classify_files")):
#     print(json.dumps({
#         "error": "missing_classify_function",
#         "detail": "Expected classifier.classify_files(list_of_paths)"
#     }))
#     sys.exit(2)


# def process_single(file_path: str, unprocessed_dir: str, rejected_dir: str,
#                    processed_db: Dict[str, Any], db_path: str) -> Dict[str, Any]:
#     """Classify and move one file based on result."""
#     file_path = abs_path(file_path)
#     result = {
#         "file_path": file_path,
#         "is_bank_statement": False,
#         "moved_to": None,
#         "error": None,
#         "skipped": False
#     }

#     if not os.path.exists(file_path):
#         result["error"] = "file_not_found"
#         print(json.dumps(result)); sys.stdout.flush(); return result

#     # Compute hash for duplicate prevention
#     try:
#         file_hash = sha256_of_file(file_path)
#     except Exception as e:
#         result["error"] = f"hash_error: {e}"
#         print(json.dumps(result)); sys.stdout.flush(); return result

#     # Skip if already processed
#     if file_hash in processed_db.get("files", {}):
#         result["skipped"] = True
#         result["reason"] = "already_processed"
#         print(json.dumps(result)); sys.stdout.flush(); return result

#     # Classify the file
#     try:
#         results = classifier.classify_files([file_path])
#     except Exception as e:
#         result["error"] = f"classifier_error: {e}"
#         print(json.dumps(result)); sys.stdout.flush(); return result

#     if not isinstance(results, list) or len(results) == 0:
#         result["error"] = "no_results_from_classifier"
#         print(json.dumps(result)); sys.stdout.flush(); return result

#     r = results[0]
#     is_bank = bool(r.get("is_bank_statement")) if isinstance(r, dict) else bool(r)
#     result["is_bank_statement"] = is_bank

#     # Decide target folder
#     try:
#         if is_bank:
#             moved = safe_move(file_path, unprocessed_dir)
#             result["moved_to"] = moved
#             result["status"] = "bank_statement -> moved_to_unprocessed"
#         else:
#             moved = safe_move(file_path, rejected_dir)
#             result["moved_to"] = moved
#             result["status"] = "not_bank_statement -> moved_to_rejected"
#     except Exception as e:
#         result["error"] = f"move_error: {e}"

#     # Update DB
#     processed_db["files"][file_hash] = {
#         "original_name": os.path.basename(file_path),
#         "is_bank_statement": is_bank,
#         "moved_to": result.get("moved_to"),
#         "timestamp": int(__import__("time").time())
#     }
#     save_processed_db(db_path, processed_db)

#     print(json.dumps(result)); sys.stdout.flush()
#     return result


# def process_batch(files: List[str], unprocessed_dir: str, rejected_dir: str,
#                   processed_db: Dict[str, Any], db_path: str):
#     """Process all files in batch (one by one)."""
#     for f in files:
#         process_single(f, unprocessed_dir, rejected_dir, processed_db, db_path)


# def main(argv):
#     script_dir = os.path.dirname(os.path.abspath(__file__))
#     input_dir = os.path.join(script_dir, "input")
#     output_root = os.path.join(script_dir, "output")
#     unprocessed_dir = os.path.join(output_root, "unprocessed")
#     rejected_dir = os.path.join(output_root, "rejected")
#     db_path = os.path.join(output_root, "processed_db.json")

#     ensure_dir(input_dir)
#     ensure_dir(unprocessed_dir)
#     ensure_dir(rejected_dir)

#     processed_db = load_processed_db(db_path)

#     # If no args, process ./input
#     if len(argv) == 0:
#         target = input_dir
#     else:
#         target = argv[0]
#     target = abs_path(target)

#     if os.path.isfile(target):
#         process_single(target, unprocessed_dir, rejected_dir, processed_db, db_path)
#         return

#     if os.path.isdir(target):
#         files = [os.path.join(target, f) for f in os.listdir(target)
#                  if os.path.isfile(os.path.join(target, f))]
#         if not files:
#             print(json.dumps({"info": f"No files found in {target}"}))
#             return
#         process_batch(files, unprocessed_dir, rejected_dir, processed_db, db_path)
#         return

#     print(json.dumps({"error": "invalid_target", "detail": target}))


# if __name__ == "__main__":
#     try:
#         main(sys.argv[1:])
#     except Exception as e:
#         print(json.dumps({
#             "error": f"Unhandled exception in run_classifier: {e}",
#             "trace": traceback.format_exc()
#         }))
#         sys.exit(2)





# ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
# /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



#!/usr/bin/env python3
# run_classifier.py
# Improved: robust is_bank detection, per-file error handling, move rejected files reliably.

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
            # backup corrupted file and start new
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
    Accepts:
      - dict with keys 'is_bank_statement', 'is_bank', 'bank', 'is_bank?'
      - numeric flags (1,0)
      - boolean values
      - string values like "true"/"false"
    Fallback: False
    """
    try:
        if isinstance(result_item, bool):
            return result_item
        if isinstance(result_item, (int, float)):
            return bool(result_item)
        if isinstance(result_item, dict):
            # look for likely keys
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
            # sometimes classifier returns 'label' or 'pred' fields
            for key in ("label", "pred", "prediction"):
                if key in result_item:
                    v = result_item[key]
                    if isinstance(v, str) and v.strip().lower() in ("bank", "bank_statement", "statement", "yes"):
                        return True
                    if isinstance(v, (int, float)):
                        return bool(v)
            # fallback: if dict contains numeric 'score' and a threshold key
            if "score" in result_item and isinstance(result_item["score"], (int, float)):
                # don't assume, leave as False (classifier should set explicit flag)
                return False
            # if no useful key found, default to False
            return False
        # if it's a string
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
        # If classifier fails, move file to rejected and record error
        try:
            moved = safe_move(file_path, rejected_dir)
            result["moved_to"] = moved
            result["status"] = "classifier_exception -> moved_to_rejected"
        except Exception as me:
            result["error"] = f"classifier_exception_and_move_failed: {e} | move_err: {me}"
            print(json.dumps(result)); sys.stdout.flush(); return result

        result["error"] = f"classifier_exception: {str(e)}"
        # Update DB as rejected so we don't retry forever
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
        # treat as rejection
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

    # classifier returned something; we expect a list with one item corresponding to our single file
    r = results[0]

    # Robustly determine bank-ness
    is_bank = _determine_is_bank(r)
    result["is_bank_statement"] = is_bank

    # Decide target folder and move
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

    # Update DB
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
        # Don't fail the run if DB save fails; log and continue
        result["db_save_error"] = str(e)

    print(json.dumps(result)); sys.stdout.flush()
    return result

def process_batch(files: List[str], unprocessed_dir: str, rejected_dir: str,
                  processed_db: Dict[str, Any], db_path: str):
    """Process all files in batch (one by one). Keep running even on individual errors."""
    # sort for deterministic processing
    files_sorted = sorted(files)
    for f in files_sorted:
        try:
            process_single(f, unprocessed_dir, rejected_dir, processed_db, db_path)
        except Exception as e:
            # ensure we print a JSON error for this file so caller can see failure
            print(json.dumps({
                "file_path": abs_path(f),
                "error": f"unhandled_exception_in_process_batch: {str(e)}",
                "trace": traceback.format_exc()
            }))
            sys.stdout.flush()
            # continue to next file

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

    # If no args, process ./input
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
