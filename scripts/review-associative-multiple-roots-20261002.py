"""Finite whole-form reviews; historical candidate frames remain immutable.

Dictionary entries establish independent heads. Compound/inflection analyses
are reviewer inferences over the listed forms, never open substring rules.
"""
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

BASE = Path('audit/associative-family-v5')
FOLDERS = {'creat': 'creation', 'relat': 'relation', 'oper': 'operation', 'mut': 'mutation'}
MW = 'https://www.merriam-webster.com/dictionary/'
GROUPS = []

def group(root, language, head, words, url, analysis):
    GROUPS.append((root, language, head, words.split(), url, analysis))

# Foreign occurrences remain excluded from creat even when the token might be
# a quotation or a name: no reviewed reading realizes the creation component.
for lang, words in {
    'en': 'creak creakily creaky', 'de': 'creak creaked creaks',
    'fr': 'creak creaks', 'es': 'creak creaks creaky', 'it': 'creak'
}.items():
    group('creat', lang, 'creak', words, MW+'creaky',
          'Independent creak sound head; selected inflections and adverb retain that head. Foreign occurrence does not supply creat.')
for lang in ['en', 'de', 'fr', 'it']:
    group('creat', lang, 'crease', 'crease', MW+'crease',
          'Independent fold/crease head, with no creation constituent.')
for lang, words in {'en':'creed creeds', 'de':'creed creeds', 'fr':'creed', 'es':'creed', 'it':'creed creeds'}.items():
    group('creat', lang, 'creed', words, MW+'creed',
          'Independent belief/creed head; a possible proper-name reading is not evidence for creation either.')
for lang in ['en', 'de', 'fr', 'es', 'it']:
    group('creat', lang, 'creel', 'creel creels' if lang=='de' else 'creel', MW+'creel',
          'Independent basket/creel head; final l belongs to that head and is not a creation suffix.')
for lang in ['en', 'fr', 'es']:
    group('creat', lang, 'acreage', 'acreage', MW+'acreage',
          'Acre + acreage morphology; internal crea letters straddle the independent acre head and its suffix.')
group('relat', 'fr', 'cancrelat', 'cancrelat',
      'https://www.dictionnaire-academie.fr/article/A9C0476',
      'Independent cockroach word borrowed from Dutch kakkerlak; internal relat is not the relation head.')
group('relat', 'it', 'prelazione', 'prelazione',
      'https://www.treccani.it/vocabolario/prelazione/',
      'Preference/pre-emption branch from praeferre/praelatus. The shared historical lation ending does not establish the modern relation component.')

# Only these saved occurrences, across their language queues, are reviewed.
for lang in ['en', 'fr', 'es', 'it']:
    group('oper', lang, 'blooper', 'blooper bloopers', MW+'blooper',
          'Independent bloop/blooper error head; oper letters are internal to it.')
    group('oper', lang, 'trooper', 'trooper troopers',
          'https://www.merriam-webster.com/grammar/usage-trooper-vs-trouper',
          'Troop + agent -er, independent of operate/operation; foreign occurrence retains that analysis.')
group('oper', 'ru', 'пере-компонент',
      'автопереключение автопереход аудиоперемотка взаимопереход видеопереговоры газоперекачивающий знакопеременный микропереключатель противоперегрузочный радиопереговор радиопереговоры скотоперегонный цветопеременный',
      'https://gramota.ru/meta/pereklyuchit',
      'Reviewed compound boundary: first component ending in о + пере- head. The overlapping опер letters do not form an independent operation component. The cited dictionary establishes переключ-; the other finite boundary analyses are reviewer inferences.')
group('mut', 'de', 'Mütze',
      '''abiturmützen absolventenmütze altherrenmütze alumütze arbeitsmütze baby-mützchen babymützchen babymütze baseball-mütze baseballmütze baseballmützen baskenmütze baskenmützen bemützter bergarbeitermütze bibermützen bikermütze bischofsmütze blaumütze blechmütze bommelmützen bundeswehrmützen bärenfellmütze bärenfellmützen chauffeursmütze chefkochmütze computermützen denkmütze denkmützen dienstmütze dienstmützen eisenbahnermütze elfenmütze erstsemestermütze erzschlafmütze eselsmütze fahrermütze federmütze fellmütze ferrari-mütze festtagsmütze fischermütze fliegermütze garnisonsmütze gebetsmütze gedankenmütze generalsmütze glücksmütze golfmütze hanfmützen häkelmützchen ig-metall-schirmmützen jagdmütze jagdmützen jakobinermütze kapitänsmütze kapitänsmützen kapuzenmütze kapuzenmützen karomütze ketzermütze kleinkindermützen klorollenmützen kochmütze kochmützen kochmützenträgern leutnantsmütze lieblingsmütze mardermütze matrosenmütze mützchen mütze mützen mützenbursche mützenburschen mützenbänder mützengröße mützenhalter mützenmacher mützenmann mützensammelns mützenschirm mützenverbot mützenwerfen nachtmütze nachtmützen nikolausmütze ofenrohrmütze offiziersmütze pagenmütze papiermütze papstmütze pelzmütze pelzmützen pilotenmütze pioniersmütze polizeimütze polizeimützen polizistenmütze porzellanmütze primanermütze propellermütze pudelmütze pudelmützen radmützen rattenmütze reisemütze reisemützen riesenmütze russenmütze samtmütze schaffnermütze schiebermütze schiffermütze schildmützen schirmmütze schirmmützen schlafmützchen schlafmütze schlafmützen schlafmützig schlafmützigkeit schlumpfmütze schlägermütze schottenmütze schülermütze seemannsmütze segelmützen skimütze skimützen soldatenmütze sonntagsmütze spitzmütze sportmützchen sportmütze sportmützen stoffmütze strickmütze strickmützen strumpfmütze studentenmütze tellermützen tiermütze totenkopfmützenträger totenmütze tuchmütze tweedmützen uniformmütze vereinsmützen waschbärenfellmütze waschbärenmütze waschbärfellmütze weihnachtsmannmütze weihnachtsmütze wintermützchen wintermütze wintermützen wollmütze wollmützen zarenfellmütze zipfelmütze zipfelmützen zobelmütze''',
      'https://www.duden.de/rechtschreibung/Muetze',
      'Independent German cap/hat Mütze head. Duden records almutium/almutia with unresolved deeper origin, not mutare. The selected compounds, diminutives and inflections preserve this head; folded ü must not manufacture mutation membership.')
group('mut', 'de', 'Anmut', 'anmut anmuten anmutend anmutende anmutet anmutung',
      'https://www.duden.de/rechtschreibung/Anmut',
      'Independent German an + muot/Mut branch, not Latin mutare. Selected derivatives and inflections are reviewer morphological inferences.')
group('mut', 'de', 'Edelmut', 'edelmut edelmutes',
      'https://www.duden.de/rechtschreibung/Edelmut',
      'Independent German edel + Mut courage/disposition branch, not Latin mutare; selected genitive retains the same head.')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def encoded(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2)+'\n').encode()

def build(stage, out):
    roots = ['creat','relat'] if stage=='creation-relation' else ['oper','mut']
    proofs, delta, pending, counts, artifacts = [], [], [], {}, {}
    for root in roots:
        old = BASE / (FOLDERS[root]+'-checkpoint-20261001')
        files = {name:(old/name).read_bytes() for name in ['linguistic-decisions.json','candidates.json.gz','inventory.json','original-families.json.gz']}
        artifacts[root] = {str(old/name):sha(raw) for name, raw in files.items()}
        ledger = json.loads(files['linguistic-decisions.json'])
        candidates = json.loads(gzip.decompress(files['candidates.json.gz']))
        inventory = json.loads(files['inventory.json'])
        for name, digest in inventory['artifacts'].items():
            if name in files:
                assert sha(files[name])==digest, (root,name)
        source = {(lang,r['lemma_id']):r for lang,rs in candidates.items() for r in rs[root]}
        rows = {(lang,r['word']):r for lang,rs in ledger['decisions'].items() for r in rs[root]}
        selected = set()
        for rt,lang,head,words,url,reason in GROUPS:
            if rt!=root:
                continue
            for word in words:
                r=rows[(lang,word)]
                assert r['status']=='uncertain', (root,lang,word,r['status'])
                key=(lang,r['lemma_id'])
                assert key not in selected
                selected.add(key)
                member=source[key]
                assert member['word']==word and member['source_family_ids']==r['source_family_ids']
                proofs.append({'root':root,'language':lang,'member':member,'historical_decision':r})
                delta.append({'root':root,'language':lang,'lemma_id':r['lemma_id'],'word':word,
                              'previous_status':'uncertain','status':'excluded','lexical_head':head,
                              'reason':reason,'source_references':[url],
                              'analysis_scope':'finite whole-form review; dictionary head plus explicit reviewer inference',
                              'source_family_ids':r['source_family_ids'],'runtime_applied':False})
        counts[root]={}
        for lang,rs in ledger['decisions'].items():
            old_counts=Counter(r['status'] for r in rs[root])
            assert {s:old_counts[s] for s in ['accepted','excluded','uncertain']}==inventory['counts'][lang]
            n=sum(1 for l,_ in selected if l==lang)
            counts[root][lang]={'accepted':old_counts['accepted'], 'excluded':old_counts['excluded']+n,
                                'reviewed_exclusions':n,'reviewed_uncertain':0,
                                'pending_review':old_counts['uncertain']-n,'total':len(rs[root])}
            for r in rs[root]:
                if r['status']=='uncertain' and (lang,r['lemma_id']) not in selected:
                    pending.append({'root':root,'language':lang,**r,'status':'pending_review','historical_status':'uncertain'})
    out.mkdir(parents=True,exist_ok=True)
    decision={'stage':stage+'-independent-heads-20261002','historical_artifacts':artifacts,
              'runtime_changed':False,'decisions':delta,'counts':counts,
              'limitations':['All decisions are confined to saved forms. No general substring or suffix rule.',
                             'Remaining historical uncertain rows are unreviewed, not investigated uncertainty.',
                             'Historical ledgers, source components, route ordering and runtime files are unchanged.']}
    contents={'decisions.json':encoded(decision),'source-records.json.gz':gzip.compress(encoded(proofs),mtime=0),
              'pending-review.json.gz':gzip.compress(encoded(pending),mtime=0)}
    for name,raw in contents.items():
        (out/name).write_bytes(raw)
    summary={'stage':decision['stage'],'artifacts':{n:sha(b) for n,b in contents.items()},
             'historical_artifacts':artifacts,'counts':counts,'reviewed_exclusions':len(delta),
             'pending_review':len(pending),'runtime_changed':False}
    (out/'inventory.json').write_bytes(encoded(summary))
    print(json.dumps({k:summary[k] for k in ['stage','reviewed_exclusions','pending_review','counts']},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('stage',choices=['creation-relation','operation-mutation'])
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    build(args.stage,args.output or BASE/(args.stage+'-independent-heads-20261002'))
