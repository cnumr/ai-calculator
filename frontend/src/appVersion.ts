// Version shown in the footer. Staging images are built with APP_BUILD set to
// the short commit (see .github/workflows/images-develop.yml), so the footer
// proves which commit is running; release images leave it empty.
export function appVersion(packageVersion: string, appBuild?: string): string {
  const build = appBuild?.trim();
  return build ? `${packageVersion}+sha.${build}` : packageVersion;
}
