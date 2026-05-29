export const getProjectIdFromPathname = (pathname: string) => {
  const segments = pathname.split("/");

  if (segments.at(1) !== "projects") {
    return null;
  }

  const projectId = segments.at(2);

  return projectId && projectId !== "new" ? projectId : null;
};

export const isNodePathActive = (pathname: string, href: string) => {
  return pathname === href || pathname.startsWith(`${href}/`);
};
