// Adds the Expo project link to app.json without committing it. The repo is
// public, and `eas init` would write the account name in as `owner`; leaving
// `owner` out makes EAS use the signed-in account. The project id comes from
// EAS_PROJECT_ID: apps/client/.env.local on a developer's machine (git
// ignores .env*), and the same variable in the project's EAS environment
// variables on the build servers.
module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID
  return projectId
    ? { ...config, extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } }
    : config
}
