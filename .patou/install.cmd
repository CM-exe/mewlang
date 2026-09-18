@echo off
setlocal
set "dir=%~dp0"
if not exist "%dir%hooks" (
  echo no %dir%hooks found - is Patou set up in this repository? 1>&2
  exit /b 1
)
for %%I in ("%dir%..") do set "repo_root=%%~fI"
git -C "%repo_root%" config core.hooksPath .patou/hooks
if errorlevel 1 exit /b 1
echo Patou activated for %repo_root%
echo   git config core.hooksPath -^> .patou/hooks
endlocal
