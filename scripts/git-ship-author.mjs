/**
 * Git author for `git-ship.mjs` release commits.
 * Uses GitHub noreply email so commits link to https://github.com/balnaimi
 * (override via GIT_SHIP_AUTHOR_NAME / GIT_SHIP_AUTHOR_EMAIL).
 */
export function gitShipAuthor() {
  const name = process.env.GIT_SHIP_AUTHOR_NAME?.trim() || "balnaimi";
  const email =
    process.env.GIT_SHIP_AUTHOR_EMAIL?.trim() ||
    "37354153+balnaimi@users.noreply.github.com";
  return { name, email };
}

export function gitCommitAuthorArgs() {
  const { name, email } = gitShipAuthor();
  return ["--author", `${name} <${email}>`];
}
