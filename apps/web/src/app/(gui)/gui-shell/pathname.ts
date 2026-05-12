export function getProjectIdFromPathname(pathname: string) {
  const segments = pathname.split("/");

  if (segments.at(1) !== "projects") {
    return null;
  }

  const projectId = segments.at(2);

  return projectId && projectId !== "new" ? projectId : null;
}

export function isNodePathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[cmdk-root]")) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
