from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'PUBLISH_PACKAGE'/'MANIFEST.json').read_text())
bad=[]
for rel,expected in manifest['sha256'].items():
    p=root/rel
    if not p.exists(): bad.append((rel,'MISSING')); continue
    if hashlib.sha256(p.read_bytes()).hexdigest()!=expected: bad.append((rel,'HASH_MISMATCH'))
if bad:
    print('VERIFICATION FAILED')
    for item in bad: print(*item)
    sys.exit(1)
print('VERIFICATION PASSED')
