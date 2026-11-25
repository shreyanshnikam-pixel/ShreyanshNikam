@echo off
setlocal EnableExtensions

rem ============================================================================
rem ShreyanshNikam Cloudflare R2 Film Uploader (Windows)
rem
rem Uploads encoded frames from D:\ShreyanshNikam-renders\encoded\<film> (or
rem assets\films\<film>) to Cloudflare R2 with immutable cache headers, sets
rem CORS via blender\r2-cors.json, and writes lightweight baseUrl manifests to
rem assets\films\<film>\manifest.json + assets\films\index.json.
rem
rem Usage (from repo root):
rem   blender\upload_r2.bat --bucket shreyanshnikam-films --public-url https://pub-xxxx.r2.dev
rem   blender\upload_r2.bat --bucket shreyanshnikam-films --public-url https://pub-xxxx.r2.dev pool echo_descent
rem   blender\upload_r2.bat --dry-run --public-url https://pub-xxxx.r2.dev
rem ============================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
pushd "%REPO_ROOT%" || exit /b 1

rem --- Locate Wrangler (D:\Tools\wrangler first, then PATH) ---
set "WRANGLER_EXE="
if exist "D:\Tools\wrangler\node_modules\.bin\wrangler.cmd" (
  set "WRANGLER_EXE=D:\Tools\wrangler\node_modules\.bin\wrangler.cmd"
) else (
  for /f "delims=" %%W in ('where wrangler.cmd 2^>nul') do (
    if not defined WRANGLER_EXE set "WRANGLER_EXE=%%W"
  )
)
if not defined WRANGLER_EXE (
  for /f "delims=" %%W in ('where wrangler 2^>nul') do (
    if not defined WRANGLER_EXE set "WRANGLER_EXE=%%W"
  )
)

rem --- Locate Python 3 ---
set "PYTHON_CMD="
where py >nul 2>&1 && (
  py -3 --version >nul 2>&1 && set "PYTHON_CMD=py -3"
)
if not defined PYTHON_CMD (
  where python >nul 2>&1 && set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
  where python3 >nul 2>&1 && set "PYTHON_CMD=python3"
)
if not defined PYTHON_CMD (
  echo [upload_r2] ERROR: Python 3 not found on PATH.
  popd
  exit /b 1
)

if defined WRANGLER_EXE (
  %PYTHON_CMD% "blender\upload_r2.py" --wrangler "%WRANGLER_EXE%" %*
) else (
  %PYTHON_CMD% "blender\upload_r2.py" %*
)
set "EC=%ERRORLEVEL%"
popd
exit /b %EC%
