"""Bounded native-identity traversal, spelling groups are review questions only."""
from collections import Counter, defaultdict
import json
import math
import zlib
from mass_source import Source, readonly
from mass_registry import Graph, canonical, sha, lookup

DEFAULTS = dict(seeds_per_role=4, native_per_source=2, arcs_per_class=8,
                max_depth=2, paths_per_class=12, frequency_observations=4, inflections=8)
LANES = dict(direct=('direct_derivation', 'conversion'), compound=('compounding',),
             orthographic=('orthographic_variant',), uncertain=('morphological_relatedness',))


def path_kind(steps):
    kinds = [s['type'] for s in steps]
    if not steps or any(s['direction'] != 'directed' for s in steps):
        return 'orthographic variant' if len(kinds) == 1 and kinds[0] == 'orthographic_variant' else 'unresolved'
    if all(k in {'direct_derivation', 'conversion'} for k in kinds):
        return 'direct derivation' if len(kinds) == 1 else 'indirect derivation'
    if 'compounding' in kinds: return 'compound' if len(kinds) == 1 else 'mixed path'
    return 'unresolved'


class Discovery:
    def __init__(self, source, registry, auxiliary, project, source_lock, limits=None, verify=True):
        self.source = Source(source, verify=verify)
        self.registry, self.aux, self.project = readonly(registry), readonly(auxiliary), readonly(project)
        self.g = Graph.__new__(Graph); self.g.db = self.registry
        self.artifacts = {a['id']: a for a in source_lock['artifacts']}
        self.sources = sorted({a['source'] for a in self.artifacts.values()})
        self.limits = dict(DEFAULTS, **(limits or {}))
        if set(self.limits) != set(DEFAULTS) or any(type(v) != int or not 1 <= v <= 100 for v in self.limits.values()):
            raise ValueError('invalid bounded discovery limits')
        if self.limits['max_depth'] > 3: raise ValueError('maximum native chain depth is three')

    def close(self):
        self.source.close(); self.registry.close(); self.aux.close(); self.project.close()

    def evidence(self, seq, ordinal=None, slot=None):
        row = self.source.record(seq); b = row['body']; artifact = self.artifacts[b['artifact']]
        value = dict(id=row['id'], artifact=b['artifact'], source=b['source'], revision=artifact['revision'],
                     url=artifact['url'], raw_locator=b['raw_locator'], claim_ordinal=ordinal, component_slot=slot,
                     source_lineage=artifact.get('lineage', {'status': 'independence_unknown'}))
        if ordinal is not None: value['claim'] = b['normalized']['claims'][ordinal]
        return value

    def frequency(self, lang, word):
        sql = '''FROM seeds s JOIN frequencies q ON q.id=s.frequency JOIN files f ON f.id=s.file
                 WHERE s.language=? AND s.word=?'''
        count = self.project.execute('SELECT COUNT(*) ' + sql, (lang, word)).fetchone()[0]
        rows = self.project.execute('''SELECT s.family,s.lemma,s.ordinal,s.raw_sha,f.path,f.sha,q.body ''' + sql +
              ' ORDER BY f.path,s.family,s.ordinal LIMIT ?', (lang, word, self.limits['frequency_observations'])).fetchall()
        values = [dict(family=f, lemma_id=l, ordinal=o, row_sha256=h.hex(), file=p, file_sha256=s,
                       observation_json=zlib.decompress(b).decode()) for f, l, o, h, p, s, b in rows]
        ranks = [json.loads(v['observation_json']).get('rank') for v in values]
        ranks = [r for r in ranks if type(r) == int and r > 0]
        return dict(status='observed' if values else 'unknown', rank=min(ranks) if ranks else None,
                    observations=values, omitted=count-len(values), identity='same_language_spelling_only')

    def unit(self, family, language):
        groups = {}; events = []; counters = Counter()
        limits = self.limits
        def log(reason, **values):
            events.append(dict(reason=reason, **values)); counters[reason] += values.get('count', 1)
        def add(identifier, steps, anchor, reverse=False):
            lex = self.source.lexeme(identifier)
            if lex['language'] != language:
                log('cross_language_excluded', id=lex['id']); return False
            word = lookup(lex['lemma']); key = (word, lex['pos'])
            guard = self.g.guard(family, language, word)
            item = groups.setdefault(key, dict(lemma=lex['lemma'], pos=lex['pos'], lexemes={}, paths={}, anchors={}, bases={}, guard=guard))
            item['lexemes'][lex['id']] = lex
            item['anchors'][sha(anchor)] = anchor
            if steps:
                path = dict(nodes=[s['src'] for s in steps] + [steps[-1]['dst']], steps=steps,
                            category=path_kind(steps), reverse_search=reverse, establishes_membership=False)
                item['paths'][sha(path)] = path
            if reverse: item['bases'][lex['id']] = lex
            return guard['status'] not in {'blocked', 'hold'}

        seeds = defaultdict(list)
        for word, head, role, proof in self.registry.execute(
                'SELECT word,head,role,proof FROM seeds WHERE family=? AND language=? ORDER BY length(word),word,head', (family, language)):
            seeds[role].append(dict(word=word, head=head, role=role, ref=json.loads(proof)))
        selected = []
        for role, rows in sorted(seeds.items()):
            selected.extend(rows[:limits['seeds_per_role']])
            for row in rows[limits['seeds_per_role']:]: log('seed_budget', seed=row)
        counters['available_seeds'] = sum(map(len, seeds.values())); counters['selected_seeds'] = len(selected)
        for seed in selected:
            word = seed['word']; counters['exact_lookups'] += 1
            blocked = self.g.guard(family, language, word)['status'] in {'blocked', 'hold'}
            # Native IDs from every source receive an independent lookup budget.
            for source in self.sources:
                # Native lookup is indexed first; a small range inventory locates source provenance.
                matches = self.source.db.execute('SELECT id,pos,seq FROM lexemes WHERE language=? AND search=? ORDER BY id', (language, word))
                chosen = []; count = 0
                for lid, pos, seq in matches:
                    meta = self.aux.execute('SELECT source FROM ranges WHERE first<=? AND last>=? ORDER BY first DESC LIMIT 1', (seq, seq)).fetchone()
                    if not meta: raise ValueError('missing source range')
                    if meta[0] != source: continue
                    count += 1
                    if len(chosen) < limits['native_per_source']: chosen.append((lid, seq))
                counters['native_matches'] += count
                if count > len(chosen): log('native_budget', seed=seed, source=source, count=count-len(chosen))
                for lid, seq in chosen:
                    anchor = dict(seed=seed, native_lexeme='lexeme:'+lid.hex(), evidence=self.evidence(seq))
                    add(lid, [], anchor)
                    if blocked:
                        log('negative_seed_not_expanded', seed=seed, native=lid.hex()); continue
                    frontier = [(lid, [], (lid,))]
                    for depth in range(limits['max_depth']):
                        next_frontier = defaultdict(list)
                        for current, steps, visited in frontier:
                            for lane, kinds in LANES.items():
                                marks = ','.join('?' for _ in kinds)
                                sql = f'SELECT dst,seq,ordinal,slot,type,direction FROM arcs WHERE src=? AND type IN ({marks}) ORDER BY dst,seq,ordinal,slot'
                                params = (current, *kinds)
                                available = self.source.db.execute(f'SELECT COUNT(*) FROM arcs WHERE src=? AND type IN ({marks})', params).fetchone()[0]
                                rows = self.source.db.execute(sql+' LIMIT ?', (*params, limits['arcs_per_class'])).fetchall()
                                counters['arcs_available'] += available; counters['arcs_examined'] += len(rows)
                                if available > len(rows): log('arc_budget', lane=lane, native=current.hex(), count=available-len(rows))
                                for dst, record, ordinal, slot, kind, direction in rows:
                                    if dst in visited: log('cycle_excluded', native=dst.hex()); continue
                                    target = self.source.lexeme(dst)
                                    if target['language'] != language: log('cross_language_excluded', id=target['id']); continue
                                    step = dict(src='lexeme:'+current.hex(), dst=target['id'], type=kind, direction=direction,
                                                evidence=self.evidence(record, ordinal, slot))
                                    path = steps+[step]; safe = add(dst, path, anchor)
                                    if not safe: log('negative_target_not_expanded', id=target['id']); continue
                                    if direction == 'directed' and kind in {'direct_derivation', 'conversion', 'compounding'}:
                                        next_frontier[path_kind(path)].append((dst, path, (*visited, dst)))
                        frontier = []
                        for kind, rows in sorted(next_frontier.items()):
                            frontier.extend(rows[:limits['paths_per_class']])
                            if len(rows) > limits['paths_per_class']: log('frontier_budget', category=kind, count=len(rows)-limits['paths_per_class'])
                        if not frontier: break
                    if frontier: log('depth_boundary', seed=seed, count=len(frontier), semantics='unexpanded native path states, not missing-word count')
                    for lane in ['direct', 'compound']:
                        kinds = LANES[lane]; marks = ','.join('?' for _ in kinds)
                        sql = f'FROM incoming WHERE dst=? AND type IN ({marks})'
                        params = (lid, *kinds)
                        count = self.aux.execute('SELECT COUNT(*) '+sql, params).fetchone()[0]
                        rows = self.aux.execute('SELECT src,seq,ordinal,slot,type,direction '+sql+' ORDER BY src,seq,ordinal,slot LIMIT ?', (*params, limits['arcs_per_class'])).fetchall()
                        if count > len(rows): log('reverse_budget', lane=lane, count=count-len(rows), native=lid.hex())
                        counters['reverse_examined'] += len(rows)
                        for src, record, ordinal, slot, kind, direction in rows:
                            step = dict(src='lexeme:'+src.hex(), dst='lexeme:'+lid.hex(), type=kind, direction=direction,
                                        evidence=self.evidence(record, ordinal, slot))
                            add(src, [step], anchor, reverse=True)
            count = self.aux.execute('SELECT COUNT(*) FROM inflections WHERE language=? AND owner=?', (language, word)).fetchone()[0]
            rows = self.aux.execute('SELECT body FROM inflections WHERE language=? AND owner=? ORDER BY eid LIMIT ?', (language, word, limits['inflections'])).fetchall()
            if count > len(rows): log('inflection_budget', seed=seed, count=count-len(rows))
            for raw, in rows:
                row = json.loads(raw); b = row['body']; lex = b['normalized']['lexemes'][0]; key=(word, lex['pos'])
                item = groups.setdefault(key, dict(lemma=lex['lemma'], pos=lex['pos'], lexemes={}, paths={}, anchors={}, bases={}, guard=self.g.guard(family, language, word)))
                item['lexemes'][lex['id']] = lex
                item['anchors'][sha(seed)] = dict(seed=seed)
                item.setdefault('inflections', {})[row['id']] = dict(evidence_id=row['id'], artifact=b['artifact'],
                    url=self.artifacts[b['artifact']]['url'], raw_locator=b['raw_locator'], category='inflection', observation=b['normalized']['inflection'])
                counters['inflections_selected'] += 1
        questions = []
        for (word, pos), item in sorted(groups.items(), key=lambda p: canonical(p[0])):
            known = [dict(family=f, lemma_id=l, head_id=h, ref=json.loads(p)) for f,l,h,p in self.registry.execute(
                'SELECT family,lemma,head,proof FROM known WHERE language=? AND word=? ORDER BY family,lemma,head', (language,word))]
            prior = [dict(family=f,status=s,proof=json.loads(p),reason=r) for f,s,p,r in self.registry.execute(
                'SELECT family,status,proof,reason FROM decisions WHERE language=? AND word=? ORDER BY family,id', (language,word))]
            paths = [item['paths'][k] for k in sorted(item['paths'])]
            directed = [p for p in paths if p['category'] in {'direct derivation','indirect derivation','compound','mixed path'}]
            competing = sorted({v['family'] for v in known} - {family})
            sources = sorted({s['evidence']['source'] for p in paths for s in p['steps']})
            categories = ['EXISTING_MEMBER_AUDIT' if any(k['family']==family for k in known) else 'NEW_MEMBER', 'IDENTITY_UNRESOLVED']
            if item['bases']: categories.append('POSSIBLE_BASE')
            if competing or len(item['lexemes']) > 1: categories.append('CONFLICT')
            if item['guard']['status'] in {'blocked','hold'} or any(p['status'] in {'rejected','excluded','split_required','blocked_from_runtime'} for p in prior): categories.append('NEGATIVE_HISTORY')
            if not directed: categories.append('LOW_EVIDENCE')
            frequency = self.frequency(language,word)
            if frequency['omitted']: log('frequency_budget', word=word, count=frequency['omitted'])
            rank = frequency['rank']; shortest = min((len(p['steps']) for p in paths), default=4)
            components = dict(path=5-min(shortest,4), directed=int(bool(directed)), uncertainty=2+int(pos is None),
                              distinct_sources=len(sources), independence_bonus=0, merge_risk=2+int(bool(competing)),
                              prior_history=2*int('NEGATIVE_HISTORY' in categories), frequency=max(0,6-int(math.log10(rank))) if rank else 0)
            questions.append(dict(family=family,language=language,lemma=item['lemma'],pos=pos,categories=sorted(categories),
                lexical_alternatives=[item['lexemes'][k] for k in sorted(item['lexemes'])],
                anchors=[item['anchors'][k] for k in sorted(item['anchors'])],discovery_paths=paths,
                inflection_observations=[item.get('inflections',{})[k] for k in sorted(item.get('inflections',{}))],
                proposed_bases=[item['bases'][k] for k in sorted(item['bases'])], existing_memberships=known,
                conflicts=dict(competing_families=competing,analysis_overlap='possible_conflict_not_proven_contradiction'),
                prior_scoped_decisions=prior,guard=item['guard'],frequency=frequency,source_count=len(sources),
                independence=dict(status='unknown',independent_groups=[],glemm_morphynet_dependency_not_resolved=True),
                priority=dict(score=sum(components.values()),components=components,calibrated_probability=None,experimental=True),
                sense_status='unresolved',pos_status='source_assertion_unverified' if pos else 'unknown',
                grouping='same_language_spelling_and_pos_not_lexeme_or_sense_identity',
                allomorph_status='finite_registry_realizations_only_no_new_rule',creates_canonical_root=False,establishes_membership=False))
        counters['questions'] = len(questions); counters['discovery_events'] = len(events)
        return questions, events, dict(counters)
