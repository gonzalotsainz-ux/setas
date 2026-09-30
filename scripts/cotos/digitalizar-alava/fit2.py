import numpy as np
P = {'Quejo':(772,371,42.8327,-3.1390),'Nograro':(910,435,42.8241,-3.1108),'Barrio':(1048,550,42.8083,-3.0882),
'Bachicabo':(1130,694,42.787,-3.0725),'Sobron':(909,815,42.774,-3.1122),'Espejo':(1293,566,42.8078,-3.0485),
'Villanane':(1149,364,42.8365,-3.0707),'Bellojin':(1372,404,42.8288,-3.0285),'Tuesta':(1399,549,42.8091,-3.0249),
'Villamaderne':(1320,445,42.8228,-3.0413),'Pinedo':(718,49,42.8755,-3.1485),'Lalastra':(264,48,42.8759,-3.2299),
'Gurendes':(882,258,42.8474,-3.118),'VVald':(1045,255,42.8471,-3.0983),'Fontecha':(1395,1004,42.7475,-3.0270),
'Caranca':(1128,114,42.8672,-3.0745),'Fresneda':(1240,50,42.8768,-3.0526),'Ribera':(264,236,42.8502,-3.2301)}
def fit(keys):
    A = np.array([[P[k][0], P[k][1], 1] for k in keys], float)
    lon = np.linalg.lstsq(A, [P[k][3] for k in keys], rcond=None)[0]
    lat = np.linalg.lstsq(A, [P[k][2] for k in keys], rcond=None)[0]
    return lon, lat
if __name__=='__main__':
    keys=list(P); lon,lat=fit(keys)
    for k in keys:
        x,y,la,lo=P[k]; print(f'{k:12s} E {(lon@[x,y,1]-lo)*82000:6.0f}  N {(lat@[x,y,1]-la)*111000:6.0f}')
    print(lon,lat)
