import numpy as np, json
from PIL import Image
from collections import deque
from fit2 import fit, P
img = np.array(Image.open('arcena-0.png').convert('RGB')).astype(int)
H, W, _ = img.shape
print(H, W)
dark = img.max(axis=2) < 40
for r in (60,):
    pass
dark[:40,:]=False; dark[-70:,:]=False; dark[:,:45]=False; dark[:,-45:]=False   # marco
dark[520:1015, :600] = False          # rótulo y cajas blancas
dark[935:1000, 410:1200] = False      # barra de escala
d = dark.copy()
for dy in range(-2,3):
    for dx in range(-2,3):
        d |= np.roll(np.roll(dark,dy,0),dx,1)
ext = np.zeros_like(d); q = deque([(200,1000)]); ext[200,1000]=True
assert not d[200,1000]
while q:
    y,x = q.popleft()
    for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
        if 0<=ny<H and 0<=nx<W and not ext[ny,nx] and not d[ny,nx]:
            ext[ny,nx]=True; q.append((ny,nx))
inside = ~ext
inside[:40,:]=False; inside[-70:,:]=False; inside[:,:45]=False; inside[:,-45:]=False
inside[520:1015,:600]=False; inside[935:1000,410:1200]=False
Image.fromarray((inside*255).astype('uint8')).save('arcena-mask.png')
Image.fromarray((d*255).astype('uint8')).save('arcena-wall.png')
print(inside.mean())

C = 3
tr = lambda x,y: [round(float(fit(list(P))[0]@[x,y,1]),5), round(float(fit(list(P))[1]@[x,y,1]),5)]
lonf, latf = fit(list(P))
tr = lambda x,y: [round(float(lonf@[x,y,1]),5), round(float(latf@[x,y,1]),5)]
hh, ww = H//C+1, W//C+1
cell = np.zeros((hh,ww), bool)
for j in range(hh):
    for i in range(ww):
        b = inside[j*C:(j+1)*C, i*C:(i+1)*C]
        cell[j,i] = b.size and b.mean() > 0.5
lab = np.zeros(cell.shape, int); n=0; sizes={}
for j in range(hh):
    for i in range(ww):
        if cell[j,i] and not lab[j,i]:
            n+=1; q=deque([(j,i)]); lab[j,i]=n; c=0
            while q:
                a,b=q.popleft(); c+=1
                for na,nb in ((a+1,b),(a-1,b),(a,b+1),(a,b-1)):
                    if 0<=na<hh and 0<=nb<ww and cell[na,nb] and not lab[na,nb]:
                        lab[na,nb]=n; q.append((na,nb))
            sizes[n]=c
grandes = [k for k,v in sizes.items() if v > 300]
print('componentes grandes', [(k, sizes[k]) for k in grandes])
polys=[]
for k in grandes:
    m = lab==k
    edges={}
    add=lambda a,b: edges.setdefault(a,[]).append(b)
    for j in range(hh):
        for i in range(ww):
            if not m[j,i]: continue
            if j==0 or not m[j-1,i]: add((i,j),(i+1,j))
            if i==ww-1 or not m[j,i+1]: add((i+1,j),(i+1,j+1))
            if j==hh-1 or not m[j+1,i]: add((i+1,j+1),(i,j+1))
            if i==0 or not m[j,i-1]: add((i,j+1),(i,j))
    rings=[]
    while edges:
        a=next(iter(edges)); ring=[a]; cur=a
        while True:
            nx=edges[cur].pop()
            if not edges[cur]: del edges[cur]
            ring.append(nx); cur=nx
            if cur==a: break
        rings.append(ring)
    ar=lambda r: sum(r[t][0]*r[t+1][1]-r[t+1][0]*r[t][1] for t in range(len(r)-1))/2
    ring=max(rings,key=lambda r:abs(ar(r)))
    polys.append([[tr(x*C,y*C) for x,y in ring]])
json.dump({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'a':1},'geometry':{'type':'MultiPolygon','coordinates':polys}}]}, open('arcena-contorno.geojson','w'))
