/**
 * Where a profile picture is served from.
 *
 * The file id is on the query string rather than the path because the route
 * only needs the employee: including it is what makes a replaced picture a new
 * URL, so the browser fetches it instead of showing the one it cached.
 */
export function avatarUrl(
  employeeId: string,
  avatarFileId: string | null | undefined,
): string | undefined {
  if (!avatarFileId) return undefined;
  return `/api/employees/${employeeId}/avatar?v=${avatarFileId}`;
}
