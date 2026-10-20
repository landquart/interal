"""Verify a complete disk project projection before serving or reusing it."""
import json
from pathlib import Path
from scale_project import hash_file


def verified_project(database):
    database=Path(database).resolve()
    receipt=json.loads((database.parent/'PROJECT.json').read_text())
    if receipt['status']!='PASS' or hash_file(database)!=receipt['database_sha256']:
        raise ValueError('project index checksum mismatch')
    return receipt
