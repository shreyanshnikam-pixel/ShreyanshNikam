@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================================
rem ShreyanshNikam Blender Cycles Film Renderer (Windows GPU)
rem
rem Renders pool, sky, and echo_descent for both desktop (16:9) and portrait
rem (9:16), then runs blender\encode.py to populate assets\films\.
rem
rem Usage (double-click for standard 1080p @ 24fps, or run from cmd/PowerShell):
rem   blender\render_films.bat
rem   blender\render_films.bat --preview
rem   blender\render_films.bat --preset 100fps
rem   blender\render_films.bat --preset 4k --fps 100
rem   blender\render_films.bat --preset 8k240 --frames 1-1200 --fps 240 --av1
rem   blender\render_films.bat --film echo_descent --preset 100fps --format avif
rem   blender\render_films.bat --preset 100fps --out D:\ShreyanshNikam-renders --cdn-base https://pub-xxx.r2.dev/films
rem ============================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
pushd "%REPO_ROOT%" || exit /b 1

set "PRESET=standard"
set "PREVIEW_FLAG="
set "FRAMES_ARG="
set "FPS_ARG="
set "FORMAT_ARG=webp"
set "AV1_FLAG="
set "DEVICE_ARG=auto"
set "ONLY_FILM="
set "CDN_BASE="
set "RENDERS_ROOT=renders"
if exist "D:\" set "RENDERS_ROOT=D:\ShreyanshNikam-renders"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--preview" (
  set "PRESET=preview"
  set "PREVIEW_FLAG=--preview"
  shift
  goto parse_args
)
if /I "%~1"=="--preset" (
  set "PRESET=%~2"
  if /I "%~2"=="preview" set "PREVIEW_FLAG=--preview"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--out" (
  set "RENDERS_ROOT=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--frames" (
  set "FRAMES_ARG=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--fps" (
  set "FPS_ARG=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--format" (
  set "FORMAT_ARG=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--av1" (
  set "AV1_FLAG=--av1"
  shift
  goto parse_args
)
if /I "%~1"=="--cdn-base" (
  set "CDN_BASE=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--device" (
  set "DEVICE_ARG=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--film" (
  set "ONLY_FILM=%~2"
  shift
  shift
  goto parse_args
)
if /I "%~1"=="--help" goto show_help
if /I "%~1"=="-h" goto show_help
echo [render_films] Unknown argument: %~1
goto show_help

:args_done

rem --- Locate Blender (PATH, then D:\Blender\*, then Program Files\Blender Foundation) ---
set "BLENDER_EXE="
for /f "delims=" %%P in ('where blender.exe 2^>nul') do (
  if not defined BLENDER_EXE set "BLENDER_EXE=%%P"
)
if not defined BLENDER_EXE (
  for /f "delims=" %%D in ('dir /b /ad /o-n "D:\Blender\blender*" 2^>nul') do (
    if not defined BLENDER_EXE (
      if exist "D:\Blender\%%D\blender.exe" (
        set "BLENDER_EXE=D:\Blender\%%D\blender.exe"
      )
    )
  )
)
if not defined BLENDER_EXE (
  if exist "D:\Blender\blender.exe" (
    set "BLENDER_EXE=D:\Blender\blender.exe"
  )
)
if not defined BLENDER_EXE (
  for /f "delims=" %%D in ('dir /b /ad /o-n "C:\Program Files\Blender Foundation\Blender*" 2^>nul') do (
    if not defined BLENDER_EXE (
      if exist "C:\Program Files\Blender Foundation\%%D\blender.exe" (
        set "BLENDER_EXE=C:\Program Files\Blender Foundation\%%D\blender.exe"
      )
    )
  )
)
if not defined BLENDER_EXE (
  if exist "C:\Program Files\Blender Foundation\Blender\blender.exe" (
    set "BLENDER_EXE=C:\Program Files\Blender Foundation\Blender\blender.exe"
  )
)
if not defined BLENDER_EXE (
  echo [render_films] ERROR: Blender not found on PATH, in "D:\Blender\", or in "C:\Program Files\Blender Foundation\".
  echo [render_films] Install Blender 4.x from https://www.blender.org/download/ and re-run.
  popd
  exit /b 1
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

echo ============================================================================
echo  Blender : %BLENDER_EXE%
echo  Python  : %PYTHON_CMD%
echo  Renders : %RENDERS_ROOT%
echo  Preset  : %PRESET%   Device: %DEVICE_ARG%   Format: %FORMAT_ARG%
if defined FRAMES_ARG echo  Frames  : %FRAMES_ARG%
if defined FPS_ARG    echo  FPS     : %FPS_ARG%
if defined CDN_BASE   echo  CDN Base: %CDN_BASE%
echo ============================================================================

rem --- Step 1: Generate procedural runway and cockpit textures for build_sky.py ---
if defined PYTHON_CMD (
  if exist "blender\make_textures.py" (
    echo [render_films] Generating textures via blender\make_textures.py ...
    %PYTHON_CMD% "blender\make_textures.py"
    if errorlevel 1 (
      echo [render_films] WARNING: make_textures.py failed (install Pillow with: %PYTHON_CMD% -m pip install pillow).
    )
  )
) else (
  echo [render_films] WARNING: Python 3 not found; skipping make_textures.py and encode.py.
)

rem --- Resolution pair per preset ---
set "RES_LAND=desktop"
set "RES_PORT=portrait"
if /I "%PRESET%"=="4k" (
  set "RES_LAND=4k"
  set "RES_PORT=4k-portrait"
)
if /I "%PRESET%"=="8k240" (
  set "RES_LAND=8k"
  set "RES_PORT=8k-portrait"
)

rem --- Shared Blender flags ---
set "COMMON_FLAGS=--preset %PRESET% --device %DEVICE_ARG%"
if defined PREVIEW_FLAG set "COMMON_FLAGS=%COMMON_FLAGS% %PREVIEW_FLAG%"
if defined FRAMES_ARG   set "COMMON_FLAGS=%COMMON_FLAGS% --frames %FRAMES_ARG%"
if defined FPS_ARG      set "COMMON_FLAGS=%COMMON_FLAGS% --fps %FPS_ARG%"

rem --- Step 2: Render films (pool, sky, echo_descent) ---
set "FILMS=pool sky echo_descent"
if defined ONLY_FILM set "FILMS=%ONLY_FILM%"

for %%F in (%FILMS%) do (
  call :render_one "%%F"
  if errorlevel 1 (
    echo [render_films] ERROR while rendering %%F.
    popd
    exit /b 1
  )
)

rem --- Step 3: Encode rendered PNGs into assets\films\ ---
if defined PYTHON_CMD (
  set "ENC_FLAGS=--renders "%RENDERS_ROOT%" --preset %PRESET% --format %FORMAT_ARG%"
  if defined FPS_ARG    set "ENC_FLAGS=!ENC_FLAGS! --fps %FPS_ARG%"
  if defined FRAMES_ARG set "ENC_FLAGS=!ENC_FLAGS! --frames %FRAMES_ARG%"
  if defined AV1_FLAG   set "ENC_FLAGS=!ENC_FLAGS! %AV1_FLAG%"
  if defined CDN_BASE   set "ENC_FLAGS=!ENC_FLAGS! --cdn-base "%CDN_BASE%""
  if defined ONLY_FILM  set "ENC_FLAGS=!ENC_FLAGS! --film %ONLY_FILM%"
  echo [render_films] Encoding rendered PNGs from %RENDERS_ROOT% into assets\films\ ...
  %PYTHON_CMD% "blender\encode.py" !ENC_FLAGS!
  if errorlevel 1 (
    echo [render_films] ERROR: encode.py failed.
    popd
    exit /b 1
  )
)

echo.
echo [render_films] All done!
popd
exit /b 0

:render_one
set "FILM_NAME=%~1"
set "SCRIPT_PATH=blender\build_%FILM_NAME%.py"
if not exist "%SCRIPT_PATH%" (
  echo [render_films] WARNING: %SCRIPT_PATH% not found; skipping %FILM_NAME%.
  exit /b 0
)
echo.
echo [render_films] Rendering %FILM_NAME% (%RES_LAND%) -> %RENDERS_ROOT%\%FILM_NAME% ...
"%BLENDER_EXE%" -b -P "%SCRIPT_PATH%" -- --out "%RENDERS_ROOT%\%FILM_NAME%" --res %RES_LAND% %COMMON_FLAGS%
if errorlevel 1 exit /b 1

echo [render_films] Rendering %FILM_NAME% (%RES_PORT%) -> %RENDERS_ROOT%\%FILM_NAME% ...
"%BLENDER_EXE%" -b -P "%SCRIPT_PATH%" -- --out "%RENDERS_ROOT%\%FILM_NAME%" --res %RES_PORT% %COMMON_FLAGS%
if errorlevel 1 exit /b 1
exit /b 0

:show_help
echo Usage: blender\render_films.bat [options]
echo   --preview                           Fast 50%% res, 64 samples, every 4th frame
echo   --preset preview^|standard^|100fps^|4k^|8k240
echo   --out ^<dir^>                         Root folder for raw PNG renders (default: D:\ShreyanshNikam-renders if D: exists, else renders)
echo   --frames ^<start-end^>                Override frame range (e.g. 1-600, 1-1000, 1-2000)
echo   --fps ^<n^>                           Override frame rate (24, 60, 100, 120, 240)
echo   --format webp^|avif                  Still image format for encode.py (default: webp)
echo   --av1                               Also write all-intra AV1 video (-c:v libaom-av1 -crf 30 -g 1)
echo   --cdn-base ^<url^>                    Optional CDN base URL (e.g. Cloudflare R2) written as baseUrl in manifest.json
echo   --device auto^|OPTIX^|CUDA^|HIP^|METAL^|ONEAPI^|CPU
echo   --film pool^|sky^|echo_descent        Render and encode only one film
popd
exit /b 0
