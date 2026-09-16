export function safeNextPath(value: string | null | undefined, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const expectedOrigin = new URL(origin).origin;
    const destination = new URL(value, expectedOrigin);
    if (destination.origin !== expectedOrigin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
