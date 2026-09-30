import numpy as np, json
P = {  # nombre: (x,y,lat,lon)
'Maeztu':(548,910,42.7385,-2.4473),'Korres':(655,1236,42.699,-2.4336),'Azazeta':(237,567,42.7785,-2.5013),
'Onraita':(895,437,42.7954,-2.3968),'Sabando':(845,810,42.7484,-2.3943),'Apellaniz':(352,950,42.7312,-2.4810),
'Ibisate':(800,655,42.7679,-2.4128),'Aletxa':(548,752,42.7557,-2.4507),'Antonana':(925,1233,42.6939,-2.3961),
'Oteo':(1090,1040,42.7166,-2.3665),'Gauna':(292,152,42.8112,-2.496),'Egileta':(62,272,42.8049,-2.5392),'Arrizala':(1052,115,42.8282,-2.3719)}
def fit(keys):
    A = np.array([[P[k][0], P[k][1], 1] for k in keys], float)
    lon = np.linalg.lstsq(A, [P[k][3] for k in keys], rcond=None)[0]
    lat = np.linalg.lstsq(A, [P[k][2] for k in keys], rcond=None)[0]
    return lon, lat
keys = list(P)
lon, lat = fit(keys)
for k in keys:
    x,y,la,lo = P[k]; e_lo=(lon@[x,y,1]-lo)*82000; e_la=(lat@[x,y,1]-la)*111000
    print(f'{k:10s} err E {e_lo:7.0f} m  N {e_la:7.0f} m')
print(lon, lat)
