import numpy as np, json, sys
from PIL import Image
from collections import deque
from fit import fit, P
img = np.array(Image.open('arraia.jpg').convert('RGB')).astype(int)
H, W, _ = img.shape
dark = (img.max(axis=2) < 110)
# Engrosar 1 px para cerrar huecos de la lÃ­nea
d = dark.copy()
for dy in (-3,-2,-1,0,1,2,3):
    for dx in (-3,-2,-1,0,1,2,3):
        d |= np.roll(np.roll(dark,dy,0),dx,1)
wall = d.copy()
wall[:38,:]=True; wall[-38:,:]=True; wall[:,:38]=True; wall[:,-38:]=True  # marco del plano
# relleno desde un punto interior (alrededor de Aletxa, al norte de Maeztu)
ext = np.zeros_like(wall); q = deque([(300,100)]); ext[300,100]=True
assert not wall[300,100]
while q:
    y,x = q.popleft()
    for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
        if 0<=ny<H and 0<=nx<W and not ext[ny,nx] and not wall[ny,nx]:
            ext[ny,nx]=True; q.append((ny,nx))
notext = ~ext
inside = np.zeros_like(notext); q = deque([(700,450)]); inside[700,450]=True
while q:
    y,x = q.popleft()
    for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
        if 0<=ny<H and 0<=nx<W and not inside[ny,nx] and notext[ny,nx]:
            inside[ny,nx]=True; q.append((ny,nx))
inside[:38,:]=False; inside[-38:,:]=False; inside[:,:38]=False; inside[:,-38:]=False
# quitar agujeros (carreteras, rótulos): todo lo que no se alcance desde fuera es interior
ext2 = np.zeros_like(inside); q = deque([(300,100)]); ext2[300,100]=True
while q:
    y,x = q.popleft()
    for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
        if 0<=ny<H and 0<=nx<W and not ext2[ny,nx] and not inside[ny,nx]:
            ext2[ny,nx]=True; q.append((ny,nx))
inside = ~ext2
# recuadros de leyenda y rÃ³tulo no deben colarse: quedan fuera por el relleno; se comprueba el Ã¡rea
print('interior px', inside.sum(), 'fracciÃ³n', inside.mean())
ys,xs = np.where(inside); print('bbox px', xs.min(), ys.min(), xs.max(), ys.max())
lon, lat = fit(list(P))
C = 3
feats = []
def tr(x,y): return [round(float(lon@[x,y,1]),5), round(float(lat@[x,y,1]),5)]
for y0 in range(0, H-C, C):
    row = inside[y0:y0+C].all(axis=0)
    x = 0
    while x < W:
        if row[x]:
            x1 = x
            while x1 < W and row[x1]: x1 += 1
            if x1 - x >= C:
                ring = [tr(x,y0), tr(x1,y0), tr(x1,y0+C), tr(x,y0+C), tr(x,y0)]
                feats.append({'type':'Feature','properties':{'a':1},'geometry':{'type':'Polygon','coordinates':[ring]}})
            x = x1
        else: x += 1
json.dump({'type':'FeatureCollection','features':feats}, open('arraia-rects.geojson','w'))
Image.fromarray((inside*255).astype('uint8')).save('arraia-mask.png')
print(len(feats))
# ---- contorno exacto sobre la rejilla de celdas (sin depender de la unión topológica) ----
cell = np.zeros((H//C+1, W//C+1), bool)
for j in range(cell.shape[0]):
    for i in range(cell.shape[1]):
        blk = inside[j*C:(j+1)*C, i*C:(i+1)*C]
        cell[j,i] = blk.size and blk.mean() > 0.5
# quedarse con la componente mayor
lab = np.zeros(cell.shape, int); n=0; sizes={}
for j in range(cell.shape[0]):
    for i in range(cell.shape[1]):
        if cell[j,i] and not lab[j,i]:
            n+=1; q=deque([(j,i)]); lab[j,i]=n; c=0
            while q:
                a,b=q.popleft(); c+=1
                for na,nb in ((a+1,b),(a-1,b),(a,b+1),(a,b-1)):
                    if 0<=na<cell.shape[0] and 0<=nb<cell.shape[1] and cell[na,nb] and not lab[na,nb]:
                        lab[na,nb]=n; q.append((na,nb))
            sizes[n]=c
big = max(sizes, key=sizes.get); cell = lab==big
edges = {}
def add(a,b): edges.setdefault(a,[]).append(b)
for j in range(cell.shape[0]):
    for i in range(cell.shape[1]):
        if not cell[j,i]: continue
        up = j==0 or not cell[j-1,i]; dn = j==cell.shape[0]-1 or not cell[j+1,i]
        lf = i==0 or not cell[j,i-1]; rt = i==cell.shape[1]-1 or not cell[j,i+1]
        if up: add((i,j),(i+1,j))
        if rt: add((i+1,j),(i+1,j+1))
        if dn: add((i+1,j+1),(i,j+1))
        if lf: add((i,j+1),(i,j))
rings=[]
while edges:
    a = next(iter(edges)); ring=[a]; cur=a
    while True:
        nxt = edges[cur].pop()
        if not edges[cur]: del edges[cur]
        ring.append(nxt); cur=nxt
        if cur==a: break
    rings.append(ring)
rings.sort(key=len, reverse=True)
def area(r): return sum(r[k][0]*r[k+1][1]-r[k+1][0]*r[k][1] for k in range(len(r)-1))/2
outer=[r for r in rings if area(r)>0]; holes=[r for r in rings if area(r)<0]
print('anillos', len(rings), 'exteriores', len(outer), 'agujeros', len(holes))
ring = max(rings, key=lambda r: abs(area(r)))
coords=[tr(x*C, y*C) for x,y in ring]
json.dump({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'a':1},'geometry':{'type':'Polygon','coordinates':[coords]}}]}, open('arraia-contorno.geojson','w'))
