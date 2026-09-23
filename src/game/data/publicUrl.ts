function appRootPathname() {
  const pathname = location.pathname;
  for (const suffix of ["/debug/map/", "/debug/map", "/beach/", "/beach"])
    if (pathname.endsWith(suffix)) {
      const root = pathname.slice(0, -suffix.length);
      return `${root || ""}/`;
    }
  if (pathname.endsWith(".html"))
    return pathname.slice(0, pathname.lastIndexOf("/") + 1);
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function publicDataUrl(path: string) {
  const clean = path.replace(/^\/+/, "");
  return new URL(`${appRootPathname()}data/${clean}`, location.origin).toString();
}

export function appRoute(path: string) {
  return `${appRootPathname()}${path.replace(/^\/+/, "")}`;
}
