"""Reproducible physical import edges, distinct from intended data flow."""
import ast
import re
from pathlib import Path
from associativvordes.v5_contract.versions import ROOT,COMPONENTS,DAG,file_sha

def graph():
    folders={v:k for k,v in COMPONENTS.items()};edges=[];dynamic=[]
    def record(source,path,line,target,kind):
        parts=target.split('.')
        if len(parts)>1 and parts[0]=='associativvordes' and parts[1] in folders:
            edges.append(dict(source=source,target=folders[parts[1]],file=str(path.relative_to(ROOT)),line=line,import_name=target,kind=kind))
    for source,folder in COMPONENTS.items():
        for path in sorted((ROOT/'associativvordes'/folder).rglob('*')):
            if '__pycache__' in path.parts or path.name.startswith('test_'):continue
            if path.suffix=='.py':
                tree=ast.parse(path.read_text());package='.'.join(path.relative_to(ROOT).with_suffix('').parts[:-1])
                for n in ast.walk(tree):
                    if isinstance(n,ast.Import):
                        for a in n.names:record(source,path,n.lineno,a.name,'python')
                    elif isinstance(n,ast.ImportFrom):
                        name=n.module or ''
                        if n.level:name='.'.join(package.split('.')[:len(package.split('.'))-n.level+1]+([name] if name else []))
                        record(source,path,n.lineno,name,'python')
                    elif isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr in {'spec_from_file_location','import_module','exec_module'}:
                        dynamic.append(dict(component=source,file=str(path.relative_to(ROOT)),line=n.lineno,call=ast.unparse(n)))
            elif path.suffix in {'.js','.mjs'}:
                for n,line in enumerate(path.read_text().splitlines(),1):
                    for rel in re.findall(r'(?:from\s*|import\s*\()[\'"]([^\'"]+)',line):
                        if rel.startswith('.'):
                            p=(path.parent/rel).resolve()
                            if p.is_relative_to(ROOT):record(source,path,n,'.'.join(p.relative_to(ROOT).with_suffix('').parts),'javascript')
    adjacency={k:set() for k in COMPONENTS}
    for e in edges:
        if e['source']!=e['target']:adjacency[e['source']].add(e['target'])
    # Strongly connected physical imports must be disclosed, not called a DAG.
    index={};low={};stack=[];active=set();groups=[]
    def visit(v):
        index[v]=low[v]=len(index);stack.append(v);active.add(v)
        for w in sorted(adjacency[v]):
            if w not in index:visit(w);low[v]=min(low[v],low[w])
            elif w in active:low[v]=min(low[v],index[w])
        if low[v]==index[v]:
            group=[]
            while True:
                w=stack.pop();active.remove(w);group.append(w)
                if w==v:break
            groups.append(sorted(group))
    for v in sorted(adjacency):
        if v not in index:visit(v)
    pending={k:set(v) for k,v in DAG.items()};order=[]
    while pending:
        ready=sorted(k for k,v in pending.items() if not v)
        if not ready:raise ValueError('declared data-flow cycle')
        order+=ready
        for k in ready:del pending[k]
        for v in pending.values():v.difference_update(ready)
    return dict(schema='interal-v5-dependencies/1',data_flow=DAG,data_flow_topological_order=order,physical_imports=edges,physical_component_dependencies={k:sorted(v) for k,v in adjacency.items()},physical_cycles=[g for g in groups if len(g)>1],dynamic_load_sites=dynamic,scope='Static Python and JS imports plus dynamic-loader inventory; does not claim runtime-generated imports are statically resolved',source_files={str(p.relative_to(ROOT)):file_sha(p) for f in COMPONENTS.values() for p in sorted((ROOT/'associativvordes'/f).rglob('*.py')) if '__pycache__' not in p.parts and not p.name.startswith('test_')})
