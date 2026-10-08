"""Build the zip file you upload to AWS Lambda.

Run from the backend folder (works on Windows, Mac and Linux):

    python deploy/build_lambda.py

Lambda runs Linux, but you may be on Windows. So instead of installing packages for
your own computer, we ask pip for the Linux-built versions of every package
(--platform manylinux2014_x86_64) and the Python version Lambda uses (3.12).
The result is build/noticeboard-lambda.zip, ready to upload in the Lambda console.
"""

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
BUILD = BACKEND / "build"
PACKAGE = BUILD / "package"
ZIP_PATH = BUILD / "noticeboard-lambda.zip"
LAMBDA_PYTHON = "3.12"
LAMBDA_PLATFORM = "manylinux2014_x86_64"  # x86_64 architecture (the Lambda default)
# The console accepts zips up to 50 MB directly; bigger ones must go through S3.
CONSOLE_LIMIT_MB = 50


def main() -> None:
    if BUILD.exists():
        shutil.rmtree(BUILD)
    PACKAGE.mkdir(parents=True)

    print("Installing Linux packages for Python", LAMBDA_PYTHON, "...")
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "--requirement", str(BACKEND / "requirements-lambda.txt"),
            "--target", str(PACKAGE),
            "--platform", LAMBDA_PLATFORM,
            "--python-version", LAMBDA_PYTHON,
            "--implementation", "cp",
            "--only-binary=:all:",  # never compile; use ready-made Linux wheels
            "--upgrade",
            "--quiet",
        ],
        check=True,
    )

    # Our own code goes next to the packages, at the top of the zip.
    shutil.copytree(
        BACKEND / "app", PACKAGE / "app",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    shutil.copy2(BACKEND / "lambda_handler.py", PACKAGE / "lambda_handler.py")

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(PACKAGE.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                zf.write(path, path.relative_to(PACKAGE).as_posix())

    size_mb = ZIP_PATH.stat().st_size / (1024 * 1024)
    print(f"Built {ZIP_PATH} ({size_mb:.1f} MB)")
    if size_mb > CONSOLE_LIMIT_MB:
        print(f"WARNING: over {CONSOLE_LIMIT_MB} MB. Upload it through S3 instead of the console.")


if __name__ == "__main__":
    main()
