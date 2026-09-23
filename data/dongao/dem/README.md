# Real cached terrain

Implemented: Copernicus GLO-30 Public, N27 E121, 2021 release. Source acquisition and SHA-256: `manifest.json`. Licence copy: `../sources/License-COPDEM-30.pdf`. Full processing and limitations: `../../../docs/data-sources.md`.

- `source.tif`: full source tile, locally cached and gitignored.
- `clipped.tif`: native-cell crop with interpolation halo, locally cached.
- `heightfield.json`: 77×69 native samples and pixel-center georeferencing; bilinear raw-height queries.
- `terrain.f32`: real DEM triangulation clipped to OSM coast; little-endian Float32 XYZ triangles in metre world coordinates.
- `mesh-manifest.json`: bbox, origin, encoding, checksum and grid spacing.

No external runtime dependency; browser verifies the local mesh SHA-256. Missing/corrupt DEM disables exploration with an explicit recoverable error. Reprocess with the scripts documented in the root README. 10m render cells do not turn 30m DSM into 10m measurements. Vertical scale is fixed at 1:1.
