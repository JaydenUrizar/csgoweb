import sys, re, urllib.request, urllib.parse, os
url, out = sys.argv[1], sys.argv[2]
def get(u): return urllib.request.urlopen(u, timeout=60).read()
m = get(url).decode()
lines = [l for l in m.splitlines() if l and not l.startswith('#')]
# choose the highest-bandwidth variant
var = re.findall(r'BANDWIDTH=(\d+).*?\n(.+)', m)
best = max(var, key=lambda x:int(x[0]))[1].strip()
vurl = urllib.parse.urljoin(url, best)
pl = get(vurl).decode()
base = vurl
init = re.search(r'#EXT-X-MAP:URI="([^"]+)"', pl)
segs = [urllib.parse.urljoin(base,l) for l in pl.splitlines() if l and not l.startswith('#')]
with open(out,'wb') as f:
    if init: f.write(get(urllib.parse.urljoin(base, init.group(1))))
    for s in segs[:40]: f.write(get(s))
print(out, os.path.getsize(out))
