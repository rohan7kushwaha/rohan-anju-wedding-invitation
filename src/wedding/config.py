import os
from pathlib import Path


def load_local_environment(project_root):
    env_file = project_root / ".env"
    if not env_file.exists():
        return

    for line_number, raw_line in enumerate(env_file.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or not key:
            raise RuntimeError(f"Invalid .env entry on line {line_number}.")

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        os.environ.setdefault(key, value)


def database_path_from_environment(project_root):
    configured_path = Path(os.environ.get("WEDDING_DB_PATH", "data/wishes.sqlite3"))
    if not configured_path.is_absolute():
        configured_path = project_root / configured_path
    return configured_path.resolve()
