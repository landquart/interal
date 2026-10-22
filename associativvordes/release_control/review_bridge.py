"""Reuse the existing append-only human ledger; never writes a decision."""
import importlib.util
import contextlib
from pathlib import Path
import sys


@contextlib.contextmanager
def locked_witnesses(root):
    path = Path(__file__).resolve().parents[1]/'review'
    sys.path.insert(0, str(path))
    spec = importlib.util.spec_from_file_location('release07_human_ledger', path/'store.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    ledger = module.Ledger(root)
    with ledger.lock():
        ledger.sync()
        yield dict(head=ledger.head, snapshot=ledger.snapshot, current=dict(ledger.current),
                    events=len(ledger.events), transactions=list(ledger.events), questions=ledger.questions)


def witnesses(root):
    with locked_witnesses(root) as value: return value
