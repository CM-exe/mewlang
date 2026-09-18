$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $dir

if (-not (Test-Path (Join-Path $dir 'hooks'))) {
    Write-Error "no $dir\hooks found - is Patou set up in this repository?"
    exit 1
}

git -C $repoRoot config core.hooksPath .patou/hooks
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Patou activated for $repoRoot"
Write-Host "  git config core.hooksPath -> .patou/hooks"
