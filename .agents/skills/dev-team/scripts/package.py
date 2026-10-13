#!/usr/bin/env python3
"""Package only the self-contained skill; no project files, credentials or symlinks."""
import pathlib
import sys
import zipfile

source = pathlib.Path(sys.argv[1]).resolve()
output = pathlib.Path(sys.argv[2]).resolve()
if output == source or source in output.parents:
    raise SystemExit("Archive must be outside the skill")
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for item in sorted(source.rglob("*")):
        if item.is_symlink() or any(p in ("__pycache__", ".DS_Store", "node_modules", ".git", ".dev-team") for p in item.relative_to(source).parts):
            continue
        if item.is_file():
            archive.write(item, pathlib.Path("dev-team") / item.relative_to(source))
print(output)
