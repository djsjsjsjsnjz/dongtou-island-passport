import json,pathlib,math
from shapely.geometry import shape,Point,LineString
from shapely.ops import unary_union,nearest_points
base=pathlib.Path('data/dongao');config=json.load(open(base/'config.json'));w,s,e,n=config['bbox']
land=unary_union([shape(f['geometry']) for f in json.load(open(base/'land.geojson'))['features']]);buildings=json.load(open(base/'buildings.geojson'));roads=json.load(open(base/'roads.geojson'))
issues=[]
for f in buildings['features']:
 g=shape(f['geometry']);outside=g.difference(land).area/max(g.area,1e-15)
 if outside>.05:issues.append(dict(id=f['id'],issue='building-outside-osm-land',outsideFraction=round(outside,4)))
osm=[f for f in buildings['features'] if str(f['id']).startswith('way/')]
duplicates=[]
for a in osm:
 g=shape(a['geometry'])
 for b in buildings['features']:
  if a['id']==b['id']:continue
  h=shape(b['geometry']);overlap=g.intersection(h).area
  if overlap/min(g.area,h.area)>.5:duplicates.append([a['id'],b['id']])
# Manually identified coarse pixel controls, never used to transform any layer.
pixels=[('半屏大桥北桥头',56.5,180.5),('半屏大桥南桥头',58.5,214.5),('东岙沙滩西侧岸线',118.5,140.5),('东岙沙滩东侧岸线',139.5,153.5)]
coast=unary_union([shape(f['geometry']) for f in json.load(open(base/'coastline.geojson'))['features']]); controls=[]
def distance(a,b):return math.hypot((a[0]-b[0])*98498,(a[1]-b[1])*110817)
for name,px,py in pixels:
 lon=w+px/256*(e-w);lat=n-py/256*(n-s);q=nearest_points(Point(lon,lat),coast)[1];osmpt=[q.x,q.y]
 controls.append(dict(id=f'ref-{len(controls)+1}',name=name,reference=[lon,lat],adopted=osmpt,distanceMeters=round(distance([lon,lat],osmpt),2),referenceSource='Sentinel-2 S2B_51RUL_20250320_0_L2A',pixel=[px,py],method='Manual coarse pixel pick; compare nearest OSM coastline point; correspondence uncertain, not surveyed control',uncertaintyMeters=20,amapRaw=None,amapWgs84=None))
pois=json.load(open(base/'pois.json'));v=next(p for p in pois if p['name']=='东岙村');b=next(p for p in pois if p['name']=='东岙沙滩')
for p,dest,role in [(v,[121.15599415965787,27.825667736962423],'road-spawn'),(b,[121.15639,27.82460],'player-arrival-unverified-entrance')]:
 controls.append(dict(id=p['id'],name=p['name'],osm=[p['longitude'],p['latitude']],adopted=dest,role=role,distanceMeters=round(distance([p['longitude'],p['latitude']],dest),2),referenceSource='OSM original vs gameplay access point (not independent)',amapRaw=None,amapWgs84=None,entrance=None))
# All shared road vertices with at least three incident segments, from original topology.
nodes={}
for f in roads['features']:
 g=f['geometry'];lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates'] if g['type']=='MultiLineString' else []
 for line in lines:
  for i,p in enumerate(line):nodes.setdefault(tuple(p),[]).extend([f['id']]*(1 if i in [0,len(line)-1] else 2))
intersections=[dict(coordinate=list(k),roads=sorted(set(v)),degree=len(v)) for k,v in nodes.items() if len(v)>=3 and len(set(v))>=2]
report=dict(buildingCount=len(buildings['features']),buildingOutsideLand=issues,duplicateCandidates=duplicates,controls=controls,roadIntersections=intersections,poiSeparationMeters=round(distance([v['longitude'],v['latitude']],[b['longitude'],b['latitude']]),2),satelliteRegistration='Coarse visual check only. No global or per-layer offset applied. Individual building registration NOT established.',amap='Not supplied; reverse transformation authority/contract not available; no GCJ-02 coordinates admitted to runtime',readyForGameplay=False)
(base/'geography-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(base/'controls.json').write_text(json.dumps(controls,ensure_ascii=False,indent=2))
print('outside-land',len(issues),'duplicates',duplicates,'intersections',len(intersections));print(controls)
