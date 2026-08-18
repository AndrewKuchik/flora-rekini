[CmdletBinding()]
param(
  [string]$OldEmail = 'admin@bayareawindowpros.com',
  [string]$NewEmail = 'andrewkuchik@gmail.com',
  [string]$NewName = 'AndrewKuchik',
  [switch]$Push
)

$ErrorActionPreference = 'Stop'

git rev-parse --show-toplevel *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Run this script inside a Git repository.'
}

$status = git status --porcelain
if ($status) {
  throw 'Working tree is not clean. Commit or stash changes first.'
}

$refs = @(git for-each-ref --format='%(refname)' refs/heads refs/tags)
if (-not $refs) {
  throw 'No local branches or tags were found to process.'
}

$envFilter = 'if [ "$GIT_AUTHOR_EMAIL" = "' + $OldEmail + '" ]; then GIT_AUTHOR_EMAIL="' + $NewEmail + '"; GIT_AUTHOR_NAME="' + $NewName + '"; fi; if [ "$GIT_COMMITTER_EMAIL" = "' + $OldEmail + '" ]; then GIT_COMMITTER_EMAIL="' + $NewEmail + '"; GIT_COMMITTER_NAME="' + $NewName + '"; fi; export GIT_AUTHOR_EMAIL GIT_AUTHOR_NAME GIT_COMMITTER_EMAIL GIT_COMMITTER_NAME'

Write-Host "Rewriting '$OldEmail' to '$NewEmail'..."
git filter-branch -f --env-filter $envFilter --tag-name-filter cat -- $refs
if ($LASTEXITCODE -ne 0) {
  throw 'Git could not rewrite the history.'
}

# filter-branch creates local backup refs; remove them so the old identity is
# not retained in the repository's reachable local references.
@(git for-each-ref --format='%(refname)' refs/original) | ForEach-Object {
  git update-ref -d $_
}
git reflog expire --expire=now --all
git gc --prune=now

git config user.name $NewName
git config user.email $NewEmail

if ($Push) {
  $remote = git remote get-url origin
  $branch = git branch --show-current
  if (-not $branch) { throw 'Could not determine the current branch.' }
  Write-Host "Pushing rewritten branch '$branch' to $remote..."
  git push --force-with-lease origin "$branch"
  if ($LASTEXITCODE -ne 0) {
    throw 'History was rewritten locally, but pushing to GitHub failed.'
  }
} else {
  Write-Host 'Done locally. Use -Push to update GitHub.'
}

Write-Host 'New Git identity:'
git config user.name
git config user.email
