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

$oldEmailB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($OldEmail))
$newEmailB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($NewEmail))
$newNameB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($NewName))

# Base64 avoids quoting problems when an email or name contains shell characters.
$envFilter = @'
decode_b64() { printf '%s' "$1" | base64 -d; }
OLD_EMAIL="$(decode_b64 '__OLD_EMAIL_B64__')"
NEW_EMAIL="$(decode_b64 '__NEW_EMAIL_B64__')"
NEW_NAME="$(decode_b64 '__NEW_NAME_B64__')"

if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]; then
  GIT_AUTHOR_EMAIL="$NEW_EMAIL"
  GIT_AUTHOR_NAME="$NEW_NAME"
fi
if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]; then
  GIT_COMMITTER_EMAIL="$NEW_EMAIL"
  GIT_COMMITTER_NAME="$NEW_NAME"
fi
export GIT_AUTHOR_EMAIL GIT_AUTHOR_NAME GIT_COMMITTER_EMAIL GIT_COMMITTER_NAME
'@
$envFilter = $envFilter.Replace('__OLD_EMAIL_B64__', $oldEmailB64)
$envFilter = $envFilter.Replace('__NEW_EMAIL_B64__', $newEmailB64)
$envFilter = $envFilter.Replace('__NEW_NAME_B64__', $newNameB64)

Write-Host "Rewriting '$OldEmail' to '$NewEmail'..."
git filter-branch -f --env-filter $envFilter --tag-name-filter cat -- $refs
if ($LASTEXITCODE -ne 0) {
  throw 'Git could not rewrite the history.'
}

git config user.name $NewName
git config user.email $NewEmail

if ($Push) {
  $remote = git remote get-url origin
  $branch = git branch --show-current
  if (-not $branch) { throw 'Не удалось определить текущую ветку.' }
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
