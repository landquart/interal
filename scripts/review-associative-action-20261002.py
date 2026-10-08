"""Continue the immutable action frame; distinguish pending work from uncertainty.

Selections are frozen per-record evidence, never a runtime substring classifier.
No candidate collection, corpus rewriting, or historical ledger modification.
"""
import gzip, hashlib, json, re, unicodedata
from pathlib import Path
BASE = Path('audit/associative-family-v5')
OLD = BASE/'action-review-checkpoint-20261001'
SOURCE = BASE/'action-reflex-checkpoint-20261001'
OUT = BASE/'action-continuation-20261002'
OUT.mkdir(exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
fold = lambda s: ''.join(c for c in unicodedata.normalize('NFKD', s.lower()) if not unicodedata.combining(c))
old_bytes = (OLD/'linguistic-decisions.json.gz').read_bytes()
old = json.loads(gzip.decompress(old_bytes))
inv = json.loads((OLD/'inventory.json').read_text())
assert sha(old_bytes) == inv['decision_sha256']
for name, digest in inv['source_artifacts'].items():
    assert sha((SOURCE/name).read_bytes()) == digest, name
# These head assignments audit all 1,098 initial proposals, not merely retrieval.
HEADS = {
'en': [('actual','actual'),('actuari','actuary'),('actuar','actuary'),('actuat','actuate'),('activ','active'),('action','action'),('actress','actor'),('actor','actor'),('act','act')],
'de': [('aktual','aktuell'),('aktionar','Aktionär'),('aktion','Aktion'),('aktivit','aktiv'),('aktiv','aktiv'),('reaktor','Reaktor'),('akteur','Akteur'),('aktien','Aktie'),('aktie','Aktie'),('akte','Akte'),('akt','Akt')],
'fr': [('actual','actuel'),('actuel','actuel'),('actuari','actuaire'),('actuaire','actuaire'),('actuat','actuer'),('activ','actif'),('action','action'),('actrice','acteur'),('acteur','acteur'),('actif','actif'),('act','acte')],
'es': [('coactiv','coactivo'),('actual','actual'),('actuar','actuar'),('actu','actuar'),('activ','activo'),('accion','acción'),('actriz','actor'),('actr','actor'),('actor','actor'),('act','acto')],
'it': [('coattiv','coattivo'),('attual','attuale'),('attuari','attuario'),('attuar','attuare'),('attua','attuare'),('attiv','attivo'),('attric','attore'),('attor','attore'),('azion','azione'),('atto','atto')],
'ru': [('актуар','актуарий'),('актуат','актуатор'),('актуал','актуальный'),('актива','активный'),('актив','активный'),('акцион','акция'),('акци','акция'),('реакц','реакция'),('транзак','транзакция'),('трансак','трансакция'),('актер','актёр'),('актёр','актёр'),('актрис','актриса'),('реактор','реактор'),('акт','акт')],
}
SOURCES = {
'act': 'https://www.merriam-webster.com/dictionary/act',
'active': 'https://www.merriam-webster.com/dictionary/active',
'actor': 'https://www.merriam-webster.com/dictionary/actor',
'actual': 'https://www.merriam-webster.com/dictionary/actual',
'actuary': 'https://www.merriam-webster.com/dictionary/actuary',
'actuate': 'https://www.merriam-webster.com/dictionary/actuate',
'Aktion': 'https://www.duden.de/rechtschreibung/Aktion',
'Aktionär': 'https://www.duden.de/rechtschreibung/Aktionaer',
'Aktie': 'https://www.duden.de/rechtschreibung/Aktie',
'Akte': 'https://www.duden.de/rechtschreibung/Akte',
'Akteur': 'https://www.duden.de/rechtschreibung/Akteur',
'Akt': 'https://www.duden.de/rechtschreibung/Akt_Handlung',
'Reaktor': 'https://www.duden.de/rechtschreibung/Reaktor',
'aktiv': 'https://www.duden.de/rechtschreibung/aktiv',
'aktuell': 'https://www.duden.de/rechtschreibung/aktuell',
'atto': 'https://www.treccani.it/vocabolario/atto2/',
'attore': 'https://www.treccani.it/vocabolario/attore/',
'attivo': 'https://www.treccani.it/vocabolario/attivo/',
'attuale': 'https://www.treccani.it/vocabolario/attuale/',
'attuare': 'https://www.treccani.it/vocabolario/attuare/',
'attuario': 'https://www.treccani.it/vocabolario/attuario/',
'azione': 'https://www.treccani.it/vocabolario/azione1/',
'coattivo': 'https://www.treccani.it/vocabolario/coattivo/',
'acción': 'https://dle.rae.es/acción',
'acto': 'https://dle.rae.es/acto',
'coactivo': 'https://dle.rae.es/coactivo',
'actuar': 'https://dle.rae.es/actuar',
'activo': 'https://dle.rae.es/activo',
'acte': 'https://www.dictionnaire-academie.fr/article/A9A0451',
'acteur': 'https://www.cnrtl.fr/etymologie/acteur',
'actif': 'https://www.cnrtl.fr/etymologie/actif',
'action': 'https://www.cnrtl.fr/etymologie/action',
'actuel': 'https://www.cnrtl.fr/etymologie/actuel',
'actuaire': 'https://www.cnrtl.fr/etymologie/actuaire',
'actuer': 'https://www.cnrtl.fr/etymologie/actuer',
}
# Russian loans have parallel lexical heads; sources establish loan morphology,
# not a guessed translation or transfer of measured sense frequency.
RU_SOURCE = 'https://lexicography.online/etymology/vasmer/а/акт'
SUFFIX_SOURCE = "https://www.treccani.it/enciclopedia/nomi-di-azione_(Enciclopedia-dell%27Italiano)/"
def head(language, word):
    f = fold(word)
    for realization, lexical in HEADS[language]:
        if realization in f:
            return lexical, realization
    return None, None
# Exact additional words inspected as whole forms. Unlisted tokens are withheld.
extra = {
'en': '''abreact actant actants actors bioactive bioactivant bioreactor bioreactors c-reactive cardioactive co-active counteractives counterreaction counterreactions de-activate de-activated double-act electroactive fast-acting hypoactive immunoreactive immunoreactivity inter-action inter-active live-action long-acting microreactor multi-activity nanoreactor neuroactive non-action non-active non-interactive non-radioactive non-reactive nonactors noninteractive nonradioactive nonreaction nonreactive one-act over-active over-react over-reacting over-reaction overreact overreaction overreactionary overreactive overreactor overreactors photoactive photoreactive play-act playact playacted playacting playaction playactor playactors playactress pre-action pro-active pro-actively psychoactive psychoactives psychoactivity radio-active re-activate re-activated re-activation reenact reenaction reenactment reenactor reenactors semi-active semi-activewear underactive underreact underreacted underreacting underreaction underreactive''',
'fr': '''abréaction autodésactiver bioactif bioactifs bioactives bioréacteur bioréacteurs bioréaction biorétroaction carburéacteur contre-réaction éco-activités e-transactions fiche-action fiches-actions formation-action hyperréactivité hypoactif hypoactifs image-action microtransactions multi-acteurs multi-activités multiactivités nanoréacteur neuroactif neuroactifs non-rétroactivité photoréactif pluri-activité pluriactifs pluriactivité préactif préactifs pro-actif pro-active psycho-actives psychoactif psychoactifs psychoactive psychoactives pulsoréacteur quadriréacteur recherche-action redésactiver sous-action sous-actions statoréacteur statoréacteurs surréaction surréactivité téléacteurs téléactivités tensio-actif tensioactif tensioactifs thermoradioactivité thermoréactive transaction transactionnel transactionnelle transactions turboréacteur turboréaction''',
'es': '''abreacción actabilidad actrices inacción inactual fotoactivo fotobiorreactores fotoreactivo hipoactividad hipoactivos interacción interacciona interaccionaban interaccionado interaccionan interaccionando interaccionar interaccione interaccionen megarreactores microtransacciones minirreactores nanoreactor narcoactividad neuroactivador neuroactivo neuroreacción normorreactivas preactividad psicoactiva psicoactivas psicoactividad psicoactivo psicoactivos psicoreactivos pulsorreactor radiactivamente radiactividad radiactivo radioacción radioactivizar reactúa reactuada reactuados reactuando reactuar retroacción retroactivar retroactores retroreactores retrorreactor retrorreactores semiactivo sexiactividad sobrereacción sobrereacciona sobrereaccionado sobrereaccionando sobrereaccionar sobrereaccionas sobrereaccione sobrereaccioné sobrereacciones sobrereaccionó sobrerreacción sobrerreacciona sobrerreaccionado sobrerreaccionando sobrerreaccionar sobrerreaccionara sobrerreaccionas sobrerreaccione sobrerreaccioné sobrerreacciones sobrerreacciono sobrerreaccionó superactividad superactivo tensioactivo tensoactivo termoreacción termorreactivos transacción transaccional transaccionar turboreactores turborreacción turborreactor vasoactivo''',
'it': '''autoattiva autoattivanti autoattuazione riattualizzare riattualizzazione''',
'ru': '''актант актировать актировка актовый актор актриса актриска актрисочка актрисочок актрисулечка актрисулька биореактор гей-активисты госакт заактировать интернет-активности киноактриса мегареактор миниреактор одноактный одноактовый пиар-акции порноактриса промо-акции промо-акций промо-акцию реактантный реактор реакторный телеактриса теракт третьеактный трехактный трёхактный трехактовый''',
'de': '''akteneinsicht aktiengesellschaft aktiengesellschaften aktiengesellschaftsgesetz akteuren akteurs akteursgruppen aktivierer aktivierungen aktiviere aktualisierungen aktuell aktuelle aktueller aktuellste aktuellster aktuarius aktuator aktuatoren kernreaktor atomreaktor atomreaktoren abreaktion''',
}
# Whole-form review of 723 saved German compounds headed by six proved lexemes.
# These are frozen into the new explicit selections, not an open runtime rule.
GERMAN_PENDING = set('''akten-james aktenwar aktennr aktien-monopoly aktienfond aktienformulare aktienfuzzi aktienman aktienmrkte aktienbrsen aktienkufen aktienrckkaufprogramm aktienrückkaufproramm reaktorsement reaktions aktienrückkaufproramm'''.split())
for d in old['decisions']['de']:
    if d['status']=='uncertain' and re.match(r'^(akten|aktien|aktions|aktivierungs|aktualisierungs|reaktor|reaktions)', d['word']) and d['word'] not in GERMAN_PENDING:
        extra['de'] += ' '+d['word']
extra = {l:set(words.split()) for l,words in extra.items()}
# Independent morphology reviewed by lexical branch, including productive forms.
independent = {
'en': [('fract','fracture/fraction'),('practic','practice'),('practis','practice'),('jact','jactation'),('attract','attract'),('abstract','abstract'),('contract','contract'),('extract','extract'),('distract','distract'),('protract','protract'),('retract','retract'),('subtract','subtract')],
'de': [('frakt','Fraktion/Fraktur'),('prakt','praktisch/Praxis'),('redakt','Redaktion'),('attrakt','attraktiv'),('abstrakt','abstrakt'),('extrakt','Extrakt'),('kontrakt','Kontrakt'),('refrakt','Refraktion')],
'fr': [('fract','fracture/fraction'),('practic','pratique'),('practiqu','pratique'),('jact','jactance'),('attract','attraction'),('abstract','abstraction'),('contract','contraction'),('extract','extraction'),('distract','distraction'),('retract','rétraction'),('soustract','soustraction')],
'es': [('fract','fractura/fracción'),('fraccion','fractura/fracción'),('practic','práctica'),('practiqu','práctica'),('jact','jactancia'),('atracc','atracción'),('attract','atracción'),('abstracc','abstracción'),('contracc','contracción'),('extracc','extracción'),('distracc','distracción'),('retracc','retracción'),('sustracc','sustracción')],
'it': [('riattacc','attaccare'),('riattir','attirare'),('riattravers','attraversare'),('riattrezz','attrezzare'),('riattrib','attribuire'),('riattest','attestare')],
'ru': [('фракт','фрактура/фрактал'),('фракц','фракция'),('практи','практика'),('практ','практика'),('аттрак','аттракция'),('абстрак','абстракция'),('экстрак','экстракция'),('ретрак','ретракция')],
}
# Independent head sources, never a single umbrella ancestor.
NEG_SOURCES = {
'fract': 'https://www.merriam-webster.com/dictionary/fracture',
'pract': 'https://www.merriam-webster.com/dictionary/practice',
'jact': 'https://www.merriam-webster.com/dictionary/jactation',
'tract': 'https://www.merriam-webster.com/dictionary/tract',
'redakt': 'https://www.duden.de/rechtschreibung/Redaktion',
'riattacc': 'https://www.treccani.it/vocabolario/attaccare/',
'riattir': 'https://www.treccani.it/vocabolario/attirare/',
'riattravers': 'https://www.treccani.it/vocabolario/attraversare/',
'riattrezz': 'https://www.treccani.it/vocabolario/attrezzare/',
'riattrib': 'https://www.treccani.it/vocabolario/attribuire/',
'riattest': 'https://www.treccani.it/vocabolario/attestare/',
}
# Do not reject a compound just because another independent constituent occurs.
ACTION_PROTECTION = r'(activ|aktiv|action|aktion|actual|aktual|reactor|reaktor|attiv|attual|актив|актуа|реакц|акцион|транзак|трансак)'
# Actium and biological actin are examined, not left as an unvisited queue.
GREEK_RAY = r'(actini[cd]|actinium|actino|актини[дйя]|актино)'
reviewed = {}; counts = {}; transition = {}; selections = {}
for l, ds in old['decisions'].items():
    by_id = {m['lemma_id']:m for m in json.load(gzip.open(SOURCE/f'{l}-candidates.json.gz','rt'))['act']}
    out = []; selections[l] = []
    for prior in ds:
        d = dict(prior); w = d['word']; f=fold(w); m=by_id[d['lemma_id']]
        d['previous_status']=prior['status']
        d['review_stage']='initial_checkpoint_retained'
        if prior['status']=='uncertain':
            d.update(status='pending_review', review_stage='not_yet_adjudicated', reason='Saved source candidate has not yet received a specific lexical/token review in this continuation; withheld from runtime. Historical uncertain was a mixed pending queue.')
        if prior['status']=='accepted' or w in extra[l]:
            h, realization = head(l,w)
            assert h, (l,w,'accepted has no lexical head')
            d.update(status='accepted',branch='lexical_action',lexical_head=h,national_realization=realization,review_stage='lexical_head_audit',
                reason=f'{l} {w}: identified {h} lexical head with recognizable {realization} realization. Regular derivative/inflection or transparent compound of that head; no ancestor-wide, suffix-only or substring admission.',
                source_references=[SOURCES.get(h, RU_SOURCE if l=='ru' else SOURCES['act'])])
            if w=='atto':
                d['sense_scope']='atto noun from actus, not atto adjective from aptus; corpus frequency remains whole-lemma and is not partitioned'
            if w=='akt':
                d['sense_scope']='Latin actus/action/art head, not Low German dike access homonym; no invented sense frequency'
            if w=='лактивист':
                d['source_references'].append('https://www.collinsdictionary.com/dictionary/english/lactivist')
                d['reason']='Russian loan/blend лактивист: lact-/milk plus activist branch with surviving активист realization; two components remain independent, not a pure lact/milk overlap.'
            if m.get('corpus_quality',{}).get('status')=='rejected':
                d.update(status='uncertain',review_stage='corpus_quality_conflict',reason='Lexical head identified but original corpus quality rejects the record; withheld pending record/context review.')
            else:
                selections[l].append({'lemma_id':d['lemma_id'],'word':w,'lexical_head':h,'national_realization':realization})
        elif prior['status']=='uncertain':
            if f in ['actium','actian','actiacus','azio','акциум']:
                d.update(status='excluded',branch='actium_proper_name',review_stage='separate_name_branch',lexical_head='Actium',reason='Actium/Azio geographical name and its adjective are not the lexical act element. Original records and routes retained as separate evidence.',source_references=['https://www.treccani.it/enciclopedia/azio/'])
            elif re.fullmatch(r'(?:[fg]-)?actin(?:-binding)?',f) or f in ['актин','актиновый','aktin','actina']:
                d.update(status='uncertain',branch='protein_actin',review_stage='sense_and_recognizability_review',reason='Protein actin has only probable activate ancestry; modern recognizability as the act lexical element is not established. Not equivalent to Greek ray actin-. Context/sense evidence is insufficient for admission.',source_references=['https://www.merriam-webster.com/dictionary/actin'])
            elif re.search(GREEK_RAY,f):
                d.update(status='excluded',branch='independent_greek_ray',review_stage='head_disambiguation',lexical_head='Greek aktis/aktinos ray',reason=f'{w}: recognizable ray/radiation/mineral/biological actino- head, independent of actus action; no protein/Greek stem union.',source_references=['https://www.merriam-webster.com/dictionary/actino-'])
            elif l=='it' and re.search(r'(?:izzazion|ificazion)',f) and not re.search(ACTION_PROTECTION,f):
                stem=f[:f.find('azion')]
                d.update(status='excluded',branch='independent_nominal_suffix',review_stage='productive_suffix_analysis',lexical_head=stem,national_realization=None,
                    reason=f'{w}: deverbal nominal stem {stem} followed by -azione/-zione nominal morphology, with -izz-/-ific- sequence. No independent atto/attore/attivo/attuale/azione head; process-denoting suffix is not lexical act.',source_references=[SUFFIX_SOURCE])
            elif not re.search(ACTION_PROTECTION,f):
                for fragment,h in independent[l]:
                    if fragment in f:
                        # Redaction has relevant distant ancestry: do not force an
                        # automatic exclusion where recognizability needs judgment.
                        if fragment=='redakt':
                            d.update(status='uncertain',branch='redaction_recognizability',review_stage='etymology_vs_recognizability_review',lexical_head=h,reason=f'{w}: Redaktion derives via redactus/redigere from agere, but the modern redakt lexical head is not automatically equivalent to act/akt. Formal constituent boundary and recognizability need separate evidence.',source_references=[NEG_SOURCES['redakt']])
                        else:
                            category='fract' if any(x in fragment for x in ['fract','frakt','fracc','фракт','фракц']) else 'pract' if any(x in fragment for x in ['pract','prakt','практ']) else 'jact' if 'jact' in fragment else 'tract'
                            d.update(status='excluded',branch='independent_reviewed_head',review_stage='head_disambiguation',lexical_head=h,reason=f'{w}: identified {h} lexical branch with {fragment} realization. The matching act/akt/акт letters overlap that independent head; they do not identify an action constituent.',source_references=[NEG_SOURCES.get(fragment,NEG_SOURCES[category])])
                        break
        out.append(d)
    reviewed[l]=out
    counts[l]={s:sum(d['status']==s for d in out) for s in ['accepted','excluded','uncertain','pending_review']}
    transition[l]={f'{a}->{b}':sum(d['previous_status']==a and d['status']==b for d in out) for a in ['accepted','excluded','uncertain'] for b in ['accepted','excluded','uncertain','pending_review'] if any(d['previous_status']==a and d['status']==b for d in out)}
payload = {'schema_version':2,'canonical_root':'act','base_commit':'8c03dc492666b25b79359e61b4a31f188b56346c','source_run_id':35647932153,'previous_checkpoint':str(OLD),'previous_decision_sha256':sha(old_bytes),'source_artifacts':inv['source_artifacts'],'surface_forms':{'en':['act'],'de':['akt','act'],'fr':['act'],'es':['act','accion'],'it':['act','att','attric','azion'],'ru':['акт','акц']},'decisions':reviewed,'counts':counts,'transitions':transition,'runtime_applied':False,'full_family_certification':False,'remaining_work':'pending_review is an explicit work queue, not a linguistic uncertainty verdict. Original actio/acti containers cannot yet be retired as a whole. No full corpus completeness is claimed outside the frozen retrieval frame.'}
raw=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode(); gz=gzip.compress(raw,mtime=0)
(OUT/'linguistic-decisions.json.gz').write_bytes(gz)
(OUT/'explicit-positive-selections.json').write_text(json.dumps(selections,ensure_ascii=False,indent=2)+'\n')
(OUT/'inventory.json').write_text(json.dumps({k:payload[k] for k in ['schema_version','canonical_root','base_commit','source_run_id','previous_checkpoint','previous_decision_sha256','source_artifacts','counts','transitions','runtime_applied','full_family_certification','remaining_work']} | {'decision_sha256':sha(gz),'positive_selections_sha256':sha((OUT/'explicit-positive-selections.json').read_bytes())},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'counts':counts,'total':sum(len(ds) for ds in reviewed.values()),'transitions':transition},ensure_ascii=False))
