/** App mount prefix. Empty at `/`, `/send` when proxied under Life OS. */
export const API_PREFIX = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

export function apiUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_PREFIX}${suffix}`;
}
