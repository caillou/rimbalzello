/** The commit this build was made from, injected by vite.config.ts. The about view links to the source at this commit. */
export const commitHash: string = __COMMIT_HASH__;

/** The public repository, linked from `// source` in the footer. */
export const repositoryUrl = 'https://github.com/caillou/rimbalzello';
