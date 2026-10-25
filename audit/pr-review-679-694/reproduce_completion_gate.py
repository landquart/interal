"""Actual pre-fix692 gate compared with the current admission path."""
import json,subprocess,tempfile,types
from pathlib import Path
from unittest.mock import patch
from associativvordes.full_v5_dry_run import checks
old_sha='2395e9f6ce2b424089759b67193559c8cea6a929';source=subprocess.check_output(['git','show',old_sha+':associativvordes/full_v5_dry_run/checks.py'])
old=types.ModuleType('associativvordes.full_v5_dry_run.audit_old_checks');old.__package__='associativvordes.full_v5_dry_run';exec(compile(source,'actual-692-checks.py','exec'),old.__dict__)
class ReachedCensus(RuntimeError):pass
with tempfile.TemporaryDirectory() as td:
 work=Path(td);assert not (work/'COPY-PHASE.json').exists()
 with patch.object(old,'pinned',side_effect=ReachedCensus):
  try:old.run(work)
  except ReachedCensus:before='REACHED_CENSUS_WITHOUT_COMPLETION'
  else:raise AssertionError('unexpected old path')
 with patch.object(checks,'pinned',side_effect=ReachedCensus):
  try:checks.run(work)
  except ReachedCensus:raise AssertionError('missing completion passed gate')
  except (FileNotFoundError,ValueError,KeyError):after='REJECTED_BEFORE_CENSUS'
  else:raise AssertionError('unexpected acceptance')
 result=dict(comment_id=4367844081,status='FIXED_VERIFIED',original_pr=692,original_head_sha=old_sha,fix_introduced_in_pr=693,fix_head_sha='69fc414fe5cfbed470779b6ee1454578b1f00a99',old_result=before,new_result=after,scope='Actual missing-prerequisite gate; next expensive census replaced by a marker. No current full stage12 certification claimed.')
 Path(__file__).with_name('COMPLETION-GATE-REPRODUCTION.json').write_text(json.dumps(result,indent=2)+'\n');print(result)
