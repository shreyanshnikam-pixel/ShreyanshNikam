@echo off
rem Publish the latest site from GitHub to Cloudflare Pages (https://shreyansh-nikam.pages.dev).
rem Run from the repo folder on your PC. Needs Git and Wrangler (logged in once with: wrangler login).
cd /d "%~dp0"
echo Pulling the latest code from GitHub...
git pull --ff-only origin main || (echo Git pull failed. Fix the error above, then run this again. & pause & exit /b 1)

set "WRANGLER_EXE="
if exist "D:\Tools\wrangler\node_modules\.bin\wrangler.cmd" set "WRANGLER_EXE=D:\Tools\wrangler\node_modules\.bin\wrangler.cmd"
if not defined WRANGLER_EXE for /f "delims=" %%W in ('where wrangler.cmd 2^>nul') do if not defined WRANGLER_EXE set "WRANGLER_EXE=%%W"
if not defined WRANGLER_EXE set "WRANGLER_EXE=npx --yes wrangler"

echo Deploying to Cloudflare Pages...
call %WRANGLER_EXE% pages deploy . --project-name shreyansh-nikam --branch main --commit-dirty=true
if errorlevel 1 (echo Deploy failed. If it says you are not logged in, run: wrangler login & pause & exit /b 1)
echo Done. Open https://shreyansh-nikam.pages.dev and press Ctrl+F5 to skip the cache.
pause
