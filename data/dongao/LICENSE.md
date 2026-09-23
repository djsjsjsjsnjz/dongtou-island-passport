# Data attribution and licences

## OpenStreetMap

© OpenStreetMap contributors. OSM source data and the OSM-derived geographic database are provided under ODbL 1.0:
https://opendatacommons.org/licenses/odbl/1-0/
Individual database contents: https://opendatacommons.org/licenses/dbcl/1-0/
https://www.openstreetmap.org/copyright

## Copernicus GLO-30

The modified terrain is **produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved**.

Licence: sources/License-COPDEM-30.pdf (repository: data/dongao/sources/License-COPDEM-30.pdf).
Original licence URL: https://docs.sentinel-hub.com/api/latest/static/files/data/dem/resources/license/License-COPDEM-30.pdf
Access: https://registry.opendata.aws/copernicus-dem/
Cropping, resampling and terrain triangulation are modifications. Source metadata, acquisition time and checksum: dem/manifest.json. This is a DSM, not a surveyed bare-earth DTM.

## East Asian Buildings

Qian Shi, Jiajun Zhu, Zhengyu Liu, Haonan Guo, Mengxi Liu, Zihong Liu and Xiaoping Liu (2023), “A first high-quality vector data of buildings in East Asian countries based on a comprehensive large-scale mapping framework”, version 1, Zenodo.
https://doi.org/10.5281/zenodo.8174931
Licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

Changes: Wenzhou shapefile reprojected from its declared WGS84 UTM 49N to WGS84 longitude/latitude; bbox clipping; one overlapping candidate omitted in combined runtime data in favour of OSM; rendering uses provisional 6m heights. Source record IDs retained for attribution. No endorsement implied.

## Sentinel-2 reference

Contains modified Copernicus Sentinel data (2025), processed by ESA. COG distribution by Element 84.
https://registry.opendata.aws/sentinel-2-l2a-cogs/
Scene S2B_51RUL_20250320_0_L2A, window cropped and reprojected to WGS84 bbox. Free, full and open Copernicus Sentinel data policy. Terms:
https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice

Each source retains its own licence. ODbL obligations apply to the OSM-derived combined database; they do not replace the Copernicus or CC BY notices above. Source components are also retained separately. Code and provisional display parameters are separate from geographic facts. No Amap data, commercial basemap tiles or private imagery is redistributed.
