import json,pathlib,hashlib
import shapefile
from rasterio.warp import transform, transform_geom
from shapely.geometry import shape, mapping, box
base=pathlib.Path('data/dongao');src=base/'sources/eab/Wenzhou.shp'
w,s,e,n=json.load(open(base/'config.json'))['bbox']
crs=(src.with_suffix('.prj')).read_text(); xs,ys=transform('EPSG:4326',crs,[w,e,e,w],[s,s,n,n]);bounds=(min(xs),min(ys),max(xs),max(ys))
reader=shapefile.Reader(str(src));print('records',len(reader),'fields',reader.fields,flush=True)
features=[];clip=box(w,s,e,n)
for item in reader.iterShapeRecords(bbox=bounds):
 geom=shape(transform_geom(crs,'EPSG:4326',item.shape.__geo_interface__))
 if not geom.is_valid:geom=geom.buffer(0)
 if not geom.intersects(clip):continue
 geom=geom.intersection(clip)
 if geom.geom_type not in ['Polygon','MultiPolygon'] or geom.area<1e-12:continue
 fid=f'eab-wenzhou-{item.shape.oid}'
 features.append(dict(type='Feature',id=fid,geometry=mapping(geom),properties=dict(building='yes',source='East Asian Buildings / Shi et al.',sourceId=fid,sourceRecord=item.shape.oid,sourceUrl='https://doi.org/10.5281/zenodo.8174931',license='CC-BY-4.0',sourceCRS='WGS84 UTM Zone 49N (EPSG:32649; from source .prj)',crs='EPSG:4326',heightStatus='provisional-uniform-6m',quality='ML-extracted footprint; not surveyed; independent local validation pending')))
result=dict(type='FeatureCollection',features=features)
(base/'buildings-eab.geojson').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
print('clipped buildings',len(features),flush=True)
manifest=dict(count=len(features),bbox=[w,s,e,n],source='https://doi.org/10.5281/zenodo.8174931',license='CC-BY-4.0',sourceCRS=crs,targetCRS='EPSG:4326',method='Read source .prj; reproject individual geometries with GDAL/PROJ; intersect bbox; preserve source shapefile record index. No translation, rotation, scale fitting, procedural fill, or residential polygon conversion.',height='Uniform provisional 6 metres, no real height claim',missing='ML omissions / false positives and source age unknown locally; no independent satellite registration yet',sha256=hashlib.sha256((base/'buildings-eab.geojson').read_bytes()).hexdigest())
(base/'sources/buildings-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
