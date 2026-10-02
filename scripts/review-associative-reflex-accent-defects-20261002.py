import argparse, importlib.util
from pathlib import Path
module=importlib.util.spec_from_file_location('finite_reflex_review',Path(__file__).parent/'lib/associative-reflex-finite-review.py');review=importlib.util.module_from_spec(module);module.loader.exec_module(review)
stage='reflex-accent-defects-review-20261002-1945'
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=review.BASE/stage);review.build(stage,p.parse_args().output)
