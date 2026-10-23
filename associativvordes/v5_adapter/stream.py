"""Bounded gzip object iteration, reused from v5 baseline certification."""
import gzip,json
def pairs(path):
 """Incremental top-level object parser; retains at most one value, never a bucket tree."""
 decoder=json.JSONDecoder();buf='';pos=0;eof=False
 with gzip.open(path,'rt',encoding='utf-8') as f:
  def fill():
   nonlocal buf,pos,eof
   buf=buf[pos:];pos=0;c=f.read(65536);buf+=c;eof=not c
  def ws():
   nonlocal pos
   while True:
    while pos<len(buf) and buf[pos].isspace():pos+=1
    if pos<len(buf) or eof:return
    fill()
  def char(expected):
   nonlocal pos
   ws()
   if pos>=len(buf) or buf[pos]!=expected:raise ValueError('Expected '+expected)
   pos+=1
  def value():
   nonlocal pos
   while True:
    ws()
    try:v,end=decoder.raw_decode(buf,pos);pos=end;return v
    except json.JSONDecodeError:
     if eof:raise
     fill()
  fill();char('{');ws()
  if pos<len(buf) and buf[pos]=='}':pos+=1
  else:
   while True:
    key=value()
    if not isinstance(key,str):raise ValueError('Non-string object key')
    char(':');v=value();yield key,v;ws()
    if pos<len(buf) and buf[pos]=='}':pos+=1;break
    char(',')
  ws()
  if pos!=len(buf):raise ValueError('Trailing JSON bytes')
  # Read to gzip EOF to verify CRC/trailer, including concatenated members.
  if not eof:
   tail=f.read()
   if tail.strip():raise ValueError('Trailing JSON content')

