"""Read only Wenzhou members via HTTP ranges, never download the 23GB archive."""
import pathlib, json, hashlib, datetime
from remotezip import RemoteZip
folder=pathlib.Path('data/dongao/sources/eab');folder.mkdir(exist_ok=True)
url='https://zenodo.org/api/records/8174931/files/East_Asian_buildings.zip/content'
with RemoteZip(url,timeout=180) as z:
 for ext in ['prj','cpg','shx','shp','dbf']:
  dest=folder/f'Wenzhou.{ext}'
  if not dest.exists():
   print('Fetching',ext,flush=True);dest.write_bytes(z.read(f'China/Zhejiang/Wenzhou.{ext}'))
  print(ext,dest.stat().st_size,flush=True)
manifest=dict(url=url,doi='10.5281/zenodo.8174931',license='CC-BY-4.0',authors='Qian Shi, Jiajun Zhu, Zhengyu Liu, Haonan Guo, Mengxi Liu, Zihong Liu, Xiaoping Liu',retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),files={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in folder.glob('Wenzhou.*')})
(folder.parent/'eab-download.json').write_text(json.dumps(manifest,indent=2))
print((folder/'Wenzhou.prj').read_text(),flush=True)
