"""Offline source GeoTIFF -> native-cell crop + one-cell interpolation halo; no resampling."""
import json, hashlib, datetime, pathlib
import rasterio
from rasterio.windows import Window
import numpy as np
base=pathlib.Path('data/dongao/dem'); config=json.load(open('data/dongao/config.json'))
w,s,e,n=config['bbox']
with rasterio.open(base/'source.tif') as src:
    r0,c0=src.index(w,n); r1,c1=src.index(e,s)
    win=Window(c0-1,r0-1,c1-c0+4,r1-r0+4)
    a=src.read(1,window=win,masked=True); t=src.window_transform(win)
    west,north=t*(.5,.5)
    field=dict(crs=str(src.crs),bbox=config['bbox'],width=a.shape[1],height=a.shape[0],west=west,north=north,dx=t.a,dy=-t.e,nodata=src.nodata,values=[None if np.ma.is_masked(v) or not np.isfinite(v) else round(float(v),3) for v in a.flatten()],source='Copernicus GLO-30 / 2021 release / DSM / EGM2008 orthometric metres')
    profile=src.profile.copy();profile.update(width=a.shape[1],height=a.shape[0],transform=t)
    with rasterio.open(base/'clipped.tif','w',**profile) as dst:dst.write(a.filled(src.nodata if src.nodata is not None else -32767),1)
    manifest=dict(sourceUrl='https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N27_00_E121_00_DEM/Copernicus_DSM_COG_10_N27_00_E121_00_DEM.tif',retrievedAt=datetime.datetime.fromtimestamp((base/'source.tif').stat().st_mtime,datetime.timezone.utc).isoformat(),sourceSha256=hashlib.sha256((base/'source.tif').read_bytes()).hexdigest(),license='Copernicus DEM Licence (GLO-30/GLO-90)',resolution='1 arc-second; approximately 27.4m east-west × 30.8m north-south',verticalDatum='EGM2008 metres, DSM not bare-earth DTM',nodata=src.nodata,processing=['Native raster window with one-cell halo; pixel-center affine coordinates retained','No reprojection, no horizontal shift, no invented elevations','Runtime bilinear valid-weight interpolation; all-invalid fails closed; outside bbox blocked','Sea masked to 0m using OSM land polygons; inland water blocked','1:1 vertical scale; terrain tessellation interpolates DSM and adds no detail'],cropShape=list(a.shape),min=float(a.min()),max=float(a.max()),nodataCount=int(np.ma.count_masked(a)))
(base/'heightfield.json').write_text(json.dumps(field,separators=(',',':')))
(base/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
