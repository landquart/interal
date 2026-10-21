"""Rebuild the real pinned graph probes after proposal approval; no graph verdicts."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from store import Ledger, atomic, canonical, digest

ASSOC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ASSOC/'candidate_search'))
from search import Graph, Queue, build
from build_graph import load_registry, ingest
from records import read_json


class GraphRefreshTests(unittest.TestCase):
    def test_pinned_graph_rebuild_does_not_apply_approved_proposal(self):
        fixtures = ASSOC/'candidate_search'/'fixtures'
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); ledger = Ledger(root/'ledger'); export = root/'export'; export.mkdir()
            known = None; question_id = None
            for generation in (1, 2):
                graph = Graph()
                try:
                    load_registry(graph, read_json(fixtures/'v6.json.gz'))
                    receipt = ingest(graph, fixtures/'records.ndjson', read_json(ASSOC.parent/'data/morphology-evidence/sources/source-lock.json'))
                    self.assertGreater(receipt['records'], 10)
                    count = graph.db.execute('SELECT COUNT(*) FROM known').fetchone()[0]
                    if known is None: known = count
                    self.assertEqual(count, known)
                    self.assertEqual(graph.db.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], 0)
                    queue = Queue(root/f'queue-{generation}.sqlite')
                    try:
                        build(graph, queue, ['OCUL','PEDE','ALTER','REGUL','CREAT','NAT','INTER'], json.loads((fixtures/'frequencies.json').read_text()))
                        rows = list(queue.rows())
                    finally: queue.close()
                    # The pilot references native graph lexemes; materialize the
                    # same IDs for the review adapter, without any spelling join.
                    for q in rows:
                        q['lexeme_alternatives'] = [dict(graph.resolve(ref)['body'], id=ref['id']) for ref in q['lexeme_alternatives']]
                    raw = ''.join(canonical(q)+'\n' for q in rows).encode()
                    atomic(export/'questions.ndjson', raw)
                    atomic(export/'MANIFEST.json', canonical({'counts': {'questions':len(rows)}, 'identity':{'test_rebuild_generation':generation}, 'outputs':{'questions.ndjson':digest(raw)}}).encode())
                    ledger.import_queue(export)
                    if generation == 1:
                        q=rows[0];question_id=q['id']
                        ledger.decide('test-reviewer','reviewer',{'test-reviewer':'reviewer'},'graph-rebuild-test',
                            [{'question_id':q['id'],'expected_revision':0,'status':'ACCEPT_PROPOSED',
                              'lexeme_id':q['lexeme_alternatives'][0]['id'],'relation':'unresolved','reason':'Test proposal approval only.'}],ledger.snapshot)
                    else:
                        self.assertIn(question_id, ledger.questions)
                        self.assertEqual(ledger.state(question_id,'test-reviewer')['status'], 'ACCEPT_PROPOSED')
                        self.assertTrue(ledger.overlay({'test-reviewer':'reviewer'})[0]['source_changed'])
                        self.assertEqual(graph.db.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], 0)
                        self.assertEqual(graph.db.execute('SELECT COUNT(*) FROM known').fetchone()[0], known)
                finally: graph.close()
