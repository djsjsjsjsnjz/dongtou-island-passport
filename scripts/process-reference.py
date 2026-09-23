"""Public Sentinel-2 reference crop. Range-read COG then reproject to exact WGS84 bbox."""
import rasterio,json,pathlib,datetime
from rasterio.warp import transform_bounds,reproject,Resampling
from rasterio.windows import from_bounds
from rasterio.transform import from_bounds as affine_bounds
import numpy as np
base=pathlib.Path('data/dongao'); scene=json.load(open(base/'sources/sentinel-scene.json')); bbox=json.load(open(base/'config.json'))['bbox']; url=scene['assets']['visual']['href']
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
 with rasterio.open(url) as src:
  bounds=transform_bounds('EPSG:4326',src.crs,*bbox,densify_pts=21);win=from_bounds(*bounds,src.transform).round_offsets().round_lengths();a=src.read(window=win);tr=src.window_transform(win)
  out=np.zeros((3,256,256),dtype='uint8')
  for k in range(3):reproject(a[k],out[k],src_transform=tr,src_crs=src.crs,dst_transform=affine_bounds(*bbox,256,256),dst_crs='EPSG:4326',resampling=Resampling.bilinear)
  dest=base/'reference';dest.mkdir(exist_ok=True)
  with rasterio.open(dest/'sentinel-20250320.png','w',driver='PNG',width=256,height=256,count=3,dtype='uint8') as dst:dst.write(out)
  manifest=dict(scene=scene['id'],source=url,acquisition=scene['properties']['datetime'],retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),bbox=bbox,crs='EPSG:4326',resolution='10 m original; 256x256 display resampling does not add detail',license='Copernicus Sentinel free and open data policy',attribution='Contains modified Copernicus Sentinel data (2025), processed by ESA; COG distribution by Element 84',processing='COG window crop in native UTM, GDAL warp to exact WGS84 bbox; north at top; no manual shift',limitation='Independent coarse coastline/settlement reference only; insufficient for entrance or individual footprint verification')
  (dest/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('reference saved',flush=True)
