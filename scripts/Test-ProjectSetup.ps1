param(
  [string]$ProjectRoot = (Join-Path $PSScriptRoot '..'),
  [switch]$AllowPlaceholders
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($ProjectRoot)
$errors = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-SetupError([string]$Message) {
  $script:errors.Add($Message)
}

function Add-SetupWarning([string]$Message) {
  $script:warnings.Add($Message)
}

if (-not (Test-Path -LiteralPath $root -PathType Container)) {
  throw "Project root does not exist: $root"
}

$requiredPaths = @(
  'AGENTS.md',
  'README.md',
  'docs/AI_HANDOFF.md',
  'docs/AI_MEMORY_PROTOCOL.md',
  'docs/WORKFLOW_AND_STYLE.md',
  'docs/PROJECT_BRIEF.md',
  'docs/PROJECT_ORGANIZATION.md',
  'docs/DEVELOPMENT_SETUP.md',
  'docs/COPYING_AND_GIT.md',
  'docs/DELIVERY_PROCESS.md',
  'scripts'
)

foreach ($relativePath in $requiredPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath))) {
    Add-SetupError "Missing required template path: $relativePath"
  }
}

$briefPath = Join-Path $root 'docs/PROJECT_BRIEF.md'
if (Test-Path -LiteralPath $briefPath -PathType Leaf) {
  $briefText = Get-Content -LiteralPath $briefPath -Raw
  if ($briefText -match '(?m)^- Main project folder:\s*`?([^`\r\n]+)`?\s*$') {
    $mainFolder = $Matches[1].Trim()
    if ($mainFolder -notmatch '\{\{' -and $mainFolder -ne 'unknown' -and -not (Test-Path -LiteralPath (Join-Path $root $mainFolder))) {
      Add-SetupError "The documented main project folder does not exist: $mainFolder"
    }
  }
}

$textFiles = Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -notmatch '[\\/](\.git|local_assets|local_data|private_data|node_modules|\.venv|venv|dist|build|out)[\\/]' -and
    $_.Extension -in @('.md', '.txt', '.ps1', '.json', '.toml', '.yaml', '.yml', '.example')
  }

$placeholderHits = @()
foreach ($file in $textFiles) {
  $matches = Select-String -LiteralPath $file.FullName -Pattern '\{\{[^}]+\}\}' -AllMatches -ErrorAction SilentlyContinue
  foreach ($match in $matches) {
    $placeholderHits += [pscustomobject]@{
      File = [System.IO.Path]::GetRelativePath($root, $file.FullName)
      Line = $match.LineNumber
    }
  }
}

if ($placeholderHits.Count -gt 0) {
  $message = "Found $($placeholderHits.Count) unresolved template placeholder line(s). First: $($placeholderHits[0].File):$($placeholderHits[0].Line)"
  if ($AllowPlaceholders) {
    Add-SetupWarning $message
  } else {
    Add-SetupError $message
  }
}

$gitDirectory = Join-Path $root '.git'
if (Test-Path -LiteralPath $gitDirectory) {
  $gitCommand = Get-Command git -ErrorAction SilentlyContinue
  if (-not $gitCommand) {
    Add-SetupError 'Git metadata exists, but git is not available on PATH.'
  } else {
    $identityPath = Join-Path $root '.git-identity'
    if (-not (Test-Path -LiteralPath $identityPath -PathType Leaf)) {
      Add-SetupError 'Git is initialized, but .git-identity is missing.'
    }

    $gitName = (& git -C $root config user.name 2>$null)
    $gitEmail = (& git -C $root config user.email 2>$null)
    $hooksPath = (& git -C $root config core.hooksPath 2>$null)

    if (-not $gitName) { Add-SetupError 'Clone-local git user.name is not configured.' }
    if (-not $gitEmail) { Add-SetupError 'Clone-local git user.email is not configured.' }
    if ($hooksPath -ne '.githooks') { Add-SetupError 'Git core.hooksPath must be .githooks.' }

    if ((Test-Path -LiteralPath $identityPath -PathType Leaf) -and $gitEmail) {
      $identityText = Get-Content -LiteralPath $identityPath -Raw
      if ($identityText -match 'GIT_ALLOWED_EMAIL=["'']?([^"''\r\n]+)') {
        if ($Matches[1].Trim() -ne $gitEmail.Trim()) {
          Add-SetupError 'git user.email does not match GIT_ALLOWED_EMAIL in .git-identity.'
        }
      } else {
        Add-SetupError '.git-identity does not contain a readable GIT_ALLOWED_EMAIL value.'
      }
    }

    $trackedLocalFiles = @(& git -C $root ls-files -- '.env' '.env.*' 'local_assets/**' 'local_data/**' 'private_data/**' 'exports/**' 'artifacts/**' 2>$null) |
      Where-Object { $_ -and $_ -notmatch '(^|/)\.env\.example$' -and $_ -notmatch '(^|/)local_assets/\.gitignore$' }
    if ($trackedLocalFiles.Count -gt 0) {
      Add-SetupError "Potential local/private files are tracked by Git. First: $($trackedLocalFiles[0])"
    }
  }
} else {
  Add-SetupWarning 'Git is not initialized yet; identity, hooks, and tracked-file checks were skipped.'
}

foreach ($warning in $warnings) {
  Write-Warning $warning
}
foreach ($setupError in $errors) {
  Write-Error $setupError -ErrorAction Continue
}

Write-Output "Checked project setup: $root"
Write-Output "Result: $($errors.Count) error(s), $($warnings.Count) warning(s)"

if ($errors.Count -gt 0) {
  exit 1
}

exit 0
