export function isGitHubUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const githubDomains = ['github.com', 'www.github.com'];
    return githubDomains.includes(url.hostname) && url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isGithubUserPath(url: string, username: string): boolean {
  if (!isGitHubUrl(url)) {
    return false;
  }
  const urlObject = new URL(url);
  const pathSegments = urlObject.pathname.split('/').filter((segment) => segment !== '');
  if (pathSegments.length === 0) {
    return false;
  }
  const pathUsername = pathSegments[0];
  return pathUsername === username;
}
