"""Run: python3 tests/check_static.py. No extra packages required."""
from pathlib import Path
import re, hashlib, subprocess, os
from html.parser import HTMLParser

ROOT=Path(__file__).resolve().parents[1]
text=(ROOT/'jahiz-studio.html').read_text()
original=(ROOT/'index.html').read_text()
class IDs(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]
    def handle_starttag(self,tag,attrs):
        self.ids.extend(v for k,v in attrs if k=='id')
p=IDs();p.feed(text)
assert len(p.ids)==len(set(p.ids)), 'Duplicate element IDs'
assert re.search(r'<script type="text/plain" id="rnnWasm">(.*?)</script>',text,re.S)[1]==re.search(r'<script type="text/plain" id="rnnWasm">(.*?)</script>',original,re.S)[1], 'RNNoise binary changed'
for start,end in [('function buildOut(', 'let actx;'),('async function cleanAudio(', 'async function processedAudio(')]:
    assert text[text.index(start):text.index(end)]==original[original.index(start):original.index(end)], 'Media engine changed: '+start
assert (ROOT/'studio/theme.css').read_text().strip()==re.search(r'<style id="studioTheme">(.*?)</style>',text,re.S)[1].strip()
assert (ROOT/'studio/shell.js').read_text().strip()==re.search(r'<script id="studioShell">(.*?)</script>',text,re.S)[1].strip()
assert (ROOT/'studio/review.css').read_text().strip()==re.search(r'<style id="studioReviewTheme">(.*?)</style>',text,re.S)[1].strip(), 'review.css inline mismatch'
for source,script in [('mp3.js','studioMp3'),('mp4-chapters.js','studioMp4Chapters'),('review.js','studioReview')]:
    assert (ROOT/'studio'/source).read_text().strip()==re.search(r'<script id="'+script+r'">(.*?)</script>',text,re.S)[1].strip(), source+' inline mismatch'
for name,expected in {'index.html':'2bc1e154834d1cef906807b11360489353f65e0f0c6b8a1cf70cd73849d6be4e','jahiz.html':'d7d23118f579df7585aee4128ea52dbfb0c20a9c7b11b528b395f2081a0a2b3e'}.items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected, 'Original modified: '+name
scratch=Path(os.environ.get('TMPDIR',str(Path.home()/'.hermes/cache/scratch')))/'jahiz-studio-syntax'
scratch.mkdir(parents=True,exist_ok=True)
count=0
for i,m in enumerate(re.finditer(r'<script([^>]*)>(.*?)</script>',text,re.S)):
    if 'text/plain' in m[1]:continue
    f=scratch/f"script-{i}{'.mjs' if 'module' in m[1] else '.js'}"
    f.write_text(m[2]);subprocess.run(['node','--check',str(f)],check=True);count+=1
print(f'PASS: {len(p.ids)} unique IDs; {count} JS scripts parse; inline sources synced; RNNoise, PCM pipeline and original builds unchanged.')
