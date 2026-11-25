# ShreyanshNikam: icy portfolio redesign, build plan and hand-off notes

This file is the single source of truth for the redesign. If you are an AI (or a person) picking this up mid-way:
read **0. Status**, then **3. Architecture**, then the section for the page you are working on. The original brief is
reproduced word for word in **Appendix A** and in `docs/original-prompt.md`.

---

## 0. Status (update this every time you stop)

Legend: `[x]` done, `[~]` started, `[ ]` not started.

- [x] Repo scaffold, vendor libraries, shared CSS (`css/site.css`), shared behaviour (`js/core.js`)
- [x] Free CC0 assets gathered and credited (`credits.html`, see section 6): Poly Haven snow/overcast/frozen-lake HDRIs, snow/tile/wood/grate/rubber textures, ambientCG ice/snow/metal-plates/acoustic-foam PBR sets, Poly Haven ATC cab props (desk, laptop, clipboard, cart, pipes, camera, clock), the 747SP model, the Listener models, Echo audio, Sky Sentry voice lines
- [x] Home page (`index.html` + `js/world.js`): icy world, 8 sections, monolith → particles → cubes, glacier strata, pool dive, award shards (pinned), prisms, ambientCG 2K CC0 PBR ice (`Ice003`) & snow (`Snow008A`), frosted-glass Connect & Links card, OpenGraph 1200×630 card, noise white-flash transitions (locked 60 fps)
- [x] Projects page (`projects.html` + `js/projects.js`): two frosted ice blocks wired with ambientCG 2K CC0 PBR (`Ice003` + `Snow008A`), hover crack, fly-in, keyboard/a11y polish (locked 60 fps)
- [x] Sky Sentry page (`sky-sentry.html` + `js/sky.js` + `js/film.js`): photorealistic 747SP PBR, FAA ATC tower cab, Canada geese, cinematic camera angles, live overlays, interactive Live Detection & Risk Simulator (flock size, runway distance, drone toggle, Signal-blue bounding boxes, green→yellow→red risk bar, live Gemini summary, Solana SHA-256 stamp), Cloudflare R2 / external `baseUrl` film player wired for Cycles renders
- [x] Echo page (`echo.html` + `js/echo.js`): ice cave descent into the mine, sonar, live Sonar Telemetry HUD (real-time raycast distance in m + acoustic echo delay in ms at 343 m/s + click/tap/P-key ping), spatial audio, the Listener, the scare, reduced-motion still fallback
- [x] Credits page (`credits.html`): all CC0 assets, creators, sources, licences, OpenGraph card attribution, and teammate credits (Sky Sentry: Atharv Sharma, Pranav Atreya, Vivan Chowdhury; Echo: Atharv Sharma, Elias Chen)
- [x] Blender film kit + Cloudflare R2 pipeline (`blender/`): `common.py`, `build_pool.py`, `build_sky.py`, `build_echo_descent.py`, `make_textures.py`, `encode.py`/`encode.sh`, `render_films.bat`, `upload_r2.py`/`upload_r2.bat`, `r2-cors.json`, `blender/README.md` — all 3 builders smoke-tested cleanly in Blender 4.5.9 LTS with `--preset 100fps`
- [~] Full GPU film renders (`blender/render_films.bat --preset 100fps` writing to `D:\ShreyanshNikam-renders`, then `blender/upload_r2.bat` to publish frames to Cloudflare R2 and commit `manifest.json` with `baseUrl`). Benchmark on RTX 3060 Laptop GPU (Cycles OptiX, 1080p, 64 adaptive samples, caustics/refraction) measured ~72 s/frame after initial OptiX kernel compile, so real-time 3D remains active until an overnight full-render run.
- [ ] Optional login-gated assets (Sketchfab, Mixamo, Fab — see §6.3): rigged human characters / extra models if Shreyansh wants to sign in and drop them into the existing empties
- [x] Real-browser audit and verification (section 10 of the brief): 20/20 Playwright audits across all 5 pages at 1440×900 / 768×1024 / 390×844 + `prefers-reduced-motion: reduce`, 0 console/page errors, 0 HTTP 4xx/404s, 0px horizontal overflow, locked 60 fps (`gov.q=1`), interactive simulator & sonar HUD verified
- [x] GitHub + Cloudflare Pages deployment: pushed `main` to `github.com/shreyanshnikam-pixel/ShreyanshNikam` and deployed live static production build to `https://shreyansh-nikam.pages.dev`

Last worked on: wired ambientCG 2K PBR textures (`Ice003` + `Snow008A`), built Sky Sentry Live Detection & Risk Simulator and Echo Sonar Telemetry HUD, added Connect & Links card and 1200×630 OpenGraph cards across all 5 pages, benchmarked Cycles OptiX, passed 20/20 Playwright audits at 60 fps, pushed `main`, and deployed live to Cloudflare Pages (`https://shreyansh-nikam.pages.dev`) (2026-11-25).

---

## 1. Decisions already made with Shreyansh

| Question | Answer |
|---|---|
| Films rendered in Blender Cycles? | All 3 Blender Cycles builders (`pool`, `sky`, `echo_descent`), `render_films.bat`, `encode.py`, and Cloudflare R2 upload scripts are ready and smoke-tested on Blender 4.5.9 LTS (RTX 3060 OptiX). Until full GPU renders are run, each film scene runs as real-time 3D with `js/film.js` ready to swap in rendered frames. |
| Frame rate, render drive, and hosting for film sequences | Target **100 fps** (`--preset 100fps`) for ultra-smooth scroll scrubbing (`pool` 1,000 frames, `sky` 2,000 frames, `echo_descent` 600 frames); write large raw renders to **`D:\ShreyanshNikam-renders`** (keeping `C:` free); host encoded frame sequences externally on **Cloudflare R2** via `manifest.json` `"baseUrl"` (CORS-enabled in `js/film.js` + `blender/r2-cors.json` + `blender/upload_r2.bat`) so GitHub/Netlify stays lightweight. |
| Assets behind logins (Mixamo, Sketchfab, Fab/Quixel, TurboSquid) | Free CC0 assets (Poly Haven + ambientCG) are already downloaded and credited. Login-gated free assets (§6.3) remain optional; credit each on the Credits page if added later. |
| Where it lives | Static site for **Netlify** only. The old Claude canvas stays as the previous version. |
| Pacing | Do it all, fast. |
| Repo | Git repo named **ShreyanshNikam**, with this `plan.md`. |

Facts that must stay exactly right (do not invent anything about Shreyansh):
- Freshman at Livingston High School (LHS), New Jersey. **AP is not open to freshmen; Honors is the highest level a freshman can take; 4 of his 5 core classes are Honors.**
- Schedule: English 1 (Honors), Modern World History (Honors), Geometry (Honors), Biology (Honors), French 2 (College Prep).
- LHS facts (sources: LHS School Profile 2024–2025; College Board AP School Honor Roll, New Jersey, 2025): 39 AP courses, 13 dual-enrollment courses, 5 academic pathways and selective programs, 474 AP Scholars in one year, AP School Honor Roll at the Platinum level in 2025.
- LHS Swim; LHS Hack Club Vice President (club of 30 to 50 students); hackathons and game jams.
- Sky Sentry (HackPHS, October 2026): Best Use of Solana, Best Use of TigerData, 5th place overall. Live site https://lancerhacks-rvs8r.ondigitalocean.app, code https://github.com/pranav-atreya10/hackphs-dot. Teammates explicitly confirmed by Shreyansh: Atharv Sharma, Pranav Atreya, and Vivan Chowdhury. Credit line exactly: **"Built with Atharv Sharma, Vivan Chowdhury, and Pranav Atreya at HackPHS 2026"**
- Echo (Hack Club Haven Princeton, November 14 to 15, 2026): 1st prize, best overall. Play https://burthebear.itch.io/echo-hack-haven-princeton, code https://github.com/BurTheBear/HackHaven. Shreyansh made 18 of the 89 commits. Teammates explicitly confirmed by Shreyansh: Atharv Sharma and Elias Chen. Credit line exactly: **"Built with Atharv Sharma and Elias Chen at Hack Haven Princeton 2026"**
- Things still unconfirmed with Shreyansh: the exact "Vice President" title, and who built Sky Sentry's report step (Atharv's site credits Atharv with it).

---

## 2. Design system (from the brief, section 1 and 2)

Palette (only these): Snow `#F4F7FA` background · Frost `#E7EEF4` surfaces · Glacier `#CAD7E2` lines · Ice blue `#A9CBE3` 3D tint/glows only · Deep ice `#5E8AAB` · Polar ink `#0F1B26` text · Slate `#66788A` secondary text/HUD · White `#FFFFFF` highlights · Signal blue `#2F6FE4` the ONE accent (main CTA + active state, once per screen). Background is a soft radial Snow→Frost gradient plus film grain (never flat white). Echo starts icy and descends into darkness.

Type: Unbounded (display: name, section titles; tight leading, negative tracking) · Geist 17–18px body · Geist Mono 11–12px uppercase HUD with wide tracking. Sky Sentry keeps Big Shoulders; Echo keeps Big Shoulders Stencil + Special Elite. All from Google Fonts (SIL OFL).

HUD in screen corners: section number (01 / 07), section name, coordinates (40.7876° N, 74.3274° W) + "LIVINGSTON, NJ" (left edge, vertical), scroll percentage, live clock in America/New_York (header).

Craft rules (brief section 9): animate only transform, opacity, clip-path and shader uniforms; power3/expo.out easing; reveals 0.6–1.2 s; text staggers 0.03–0.08 s; headings line by line with a mask; never break native scroll, keyboard or anchors; all text is real HTML; reduced motion = no camera flights/particles/flashes/shake and stills instead of films; cap DPR at 2; pause rendering off-screen / hidden tab; 60 fps target; no horizontal overflow at 390 px.

---

## 3. Architecture

Static site, no build step, deployable by dragging the folder onto Netlify (app.netlify.com/drop) or connecting this repo.

```
index.html          Home / About me (icy world)
projects.html       Two ice blocks
sky-sentry.html     Sky Sentry film + how it works + awards
echo.html           Echo descent + mine + scare + how it works + award
credits.html        Every asset, creator and licence
css/site.css        Palette, type, header, HUD, buttons, glass cards, cursor, preloader, film stage, reduced motion
js/core.js          window.SITE: Lenis smooth scroll synced to ScrollTrigger via gsap.ticker; preloader (000→100 counter + growing ice crystal SVG, white flash, SplitText title rise with blur);
                    header hide-on-down/show-on-up + dark/light by [data-tone]; HUD clock/section/percent; custom cursor; frost-spread buttons; tilt cards;
                    reveals ([data-split] line-by-line words, .reveal clip-path, [data-fade], [data-stagger]); [data-count] count-ups; sound toggle (wind + crystal clicks, off by default)
js/kit.js           window.FK helpers from the previous build: base64→ArrayBuffer, GLB parse, texture from base64, JSON fetch, value noise/fbm, rng, smoothstep keys, grade pass (ACES, grain, vignette, CA), composer, quality governor, material patcher (onBeforeCompile)
js/world.js         Home 3D world (to write)
js/projects.js      Projects 3D (to write)
js/sky.js           Sky Sentry real-time film (to write)
js/echo.js          Echo real-time scene (to write)
js/vendor/          three-bundle.js (three.js r147 UMD + GLTFLoader, RGBELoader, RoomEnvironment, Sky, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, BufferGeometryUtils, MeshSurfaceSampler, RoundedBoxGeometry, SkeletonUtils),
                    gsap.min.js + ScrollTrigger.min.js + SplitText.min.js (GSAP 3.13, all plugins free), lenis.min.js (1.1.18)
assets/             echo-core.json (Listener model, cave textures, rock/bone props, Echo audio, base64), echo-scare.json (jump-scare model),
                    sky-core.json (747SP model, sunset HDR, grass/asphalt/concrete textures), sky-audio.json (radio voices + effects),
                    models/ (raw .glb), audio/ (raw .mp3), textures/ (Poly Haven snow HDR + snow_02 maps)
blender/            Film kit (to write): build_*.py scripts, render settings, commands
legacy/             The previous dark red/black build (three.js r147). Reusable pieces listed in section 9.
docs/original-prompt.md  The brief, verbatim
```

Why three.js r147 UMD (global `THREE`) and not ES modules: the previous build's tested code (747 livery shader, tower, monitors, birds, cave, ping shader, medals) is r147 and uses `THREE.*` globals; porting to r150+ changes colour management and light units. Keep r147 unless you have time to port and re-tune every scene.

Rendering pipeline per scene: `renderer.toneMapping = NoToneMapping`, linear output, `EffectComposer` with a HalfFloat target → `UnrealBloomPass` → final grade `ShaderPass` that does ACES + gamma + grain + vignette + chromatic aberration (+ on the home page: a noise-masked white flash and an underwater tint). See `FK.composer` / `FK.gradePass` in `js/kit.js`.

Scroll: Lenis drives the page; each 3D page reads progress from its own DOM sections (`getBoundingClientRect`) so text and camera always agree. Pinned sections use ScrollTrigger `pin`.

Film slots (for the Cycles renders later): each film section gets a `<canvas>` frame player. When `assets/films/<name>/manifest.json` exists (`{fps, count, w, h, portrait:{w,h,count}, chunks:[...]}`) the page draws frame `round(progress * (count-1))` from preloaded AVIF/WebP chunks (preload the next chunk ahead, keep ±1 chunk in memory), and draws live overlays on top. If the manifest is missing, the real-time scene runs instead. Write this player once in `js/film.js`.

---

## 4. Page plans (what to build, concretely)

### 4.1 Preloader (all pages, `core.js` + markup in each page)
Mono counter 000→100 bound to real asset loading (`SITE.setLoad(v)`), SVG ice crystal (six arms with branches, strokes drawn by dashoffset) grows from a point, white flash, then `[data-intro]` title chars rise from below with blur (SplitText).

### 4.2 Home (`index.html`, `js/world.js`): one continuous flight through an icy world
World setup: `scene.background` = canvas radial gradient Snow→Frost (needed so transmission refracts something), `FogExp2` Snow, cold low sun with soft shadows, hemisphere light, PMREM env from `assets/textures/snow.hdr` (Poly Haven snow_field_puresky), snowfield ground (snow_02 diffuse/normal/roughness, tiled), faint glacier-coloured grid/contour lines fading with distance, distant displaced snow mountains for depth, drifting snow (Points, custom shader, wind, 6k desktop / 1.5k mobile), idle breathing camera.
Ice material: `MeshPhysicalMaterial({transmission:1, ior:1.31, thickness:1.5, roughness:.08, attenuationColor:#A9CBE3, attenuationDistance:2.5, envMapIntensity:1.2})`; dissolves use an `onBeforeCompile` noise `discard` with a `uDissolve` uniform.
Camera: one `CatmullRomCurve3` through 7 anchor viewpoints + a matching look-at curve; position along it = section index + eased in-section fraction (holds in the middle 50% of each section).
Sections (DOM text alternates left/right; the hero object sits in the opposite half):
1. **Hero**: tall refractive ice monolith (RoundedBox 1.4×5×1.4 with inner crystal shards) floating over misty snow. HUD line "Freshman at Livingston High School, New Jersey", name "Shreyansh Nikam." (Unbounded), rotating "I build" line, stats (4 awards this fall · 2 competitions, both with awards · 1st, prize, best overall), buttons (Signal blue "See my projects and achievements" → projects.html, ghost "Read about me" → #about), scroll cue = thin line with a snowflake moving down.
2. **About me**: title "I build things that have to work when it matters." + the body paragraph (brief 7, section 02). The monolith dissolves: `MeshSurfaceSampler` points from its surface blow out with curl-like noise into a snow vortex while the camera drifts down.
3. **The classroom**: four ice cubes, each with a number frozen inside (39, 13, 5, 474; canvas textures re-drawn during the count-up), the points re-form into the cubes. DOM has the same stats + Platinum line + sources line.
4. **How LHS levels its courses**: camera tracks along a glacier cross-section, three strata (AP top, Honors middle and glowing, College Prep bottom). DOM: "Honors is the highest level a freshman can take. Four of my five are Honors." + frosted-glass schedule list.
5. **Beyond the classroom** (film slot `pool`): the ice surface melts to water, camera drops beneath into a competition pool: tiles with lane T-lines, animated caustics, light shafts, bubbles, a swimmer silhouette gliding overhead, then rises and the water re-freezes. Three frosted cards (Athletics: LHS Swim; Leadership: LHS Hack Club, Vice President; Competitions: Hackathons and game jams).
6. **Fall 2026: two competitions, four awards** (pinned, signature): four ice shards rotate in one per award with text etched inside (BEST USE SOLANA · BEST USE TIGERDATA · OVERALL 5TH PLACE (Sky Sentry, HackPHS, October 2026) · 1ST PRIZE BEST OVERALL (Echo, Hack Club Haven Princeton, November 14 to 15, 2026)). Links "Watch the Sky Sentry film", "Enter the Hollow".
7. **How I work + outro**: three ice prisms (01 Any team, any stack · 02 End to end · 03 Tested before done, with the existing descriptions), then camera rises over the whole world. Outro "Two projects. One fall." + "Watch Sky Sentry catch a flock before it reaches the runway, then walk into the mine from Echo." + final Signal-blue button. Footer "Shreyansh Nikam, Livingston High School, New Jersey".
Transitions: post-pass white flash with a noise mask peaking at each section boundary (amount ~0.55), off in reduced motion.

### 4.3 Projects (`projects.html`, `js/projects.js`)
Two large ice blocks (Sky Sentry, Echo) in real 3D with refraction; awards etched inside (canvas text planes). Real `<a>` links overlaid on each block for keyboard/screen readers. Hover (pointer or focus): block widens (scale x 1.12), inner light brightens, crack lines fade in (crack texture plane), the other block dims. Click: prevent default, camera flies into the block (GSAP), white flash, then navigate. Below: the awards list in HTML.

### 4.4 Sky Sentry (`sky-sentry.html`, `js/sky.js`): film slot `sky`, real-time until renders exist
Storyboard (brief 7): 1 cockpit at cruise above clouds pre-dawn (generated cockpit: glareshield, glowing PFD/ND canvas displays, window frames, yokes, gloved hands); 2 descent through clouds (24+ fbm alpha slices = pseudo-volumetric, whiteout, moisture streaks shader on glass); 3 breakout over a snowy airport at dawn (reuse legacy airport: runway markings, approach lights strobing toward the threshold, PAPI 2 red/2 white, snow textures `asphalt_snow`, `snow_field_aerial`), airliner on a 3° glideslope at ~140 kt; 4 chase cam (landing light cones, strobes, wingtip vortex particles); 5 flock of 50+ geese (instanced, flapping in the vertex shader) + a quadcopter drone with blinking nav lights; 6 Sky Sentry camera POV with sensor noise, Signal-blue boxes with IDs and tracking lines (2D canvas overlay), approach corridor, risk meter green→yellow→red; 7 tower interior (reuse legacy tower + monitors), alert panel, voice alert, ATC "go around" (new Kokoro TTS line needed), Gemini report types out, Solana stamp appears; 8 go-around: spool up, pitch up, climb over the flock with shake, back into cloud, fade to white; 9 how it works, my part, awards, live-site link, exact credit line.
Audio: Kokoro voices (see `assets/sky-audio.json`; regenerate new lines with `legacy/generators` notes in 6.2), engine, wind, alarm; spatialise with PannerNode HRTF; off by default with "Best with headphones".

### 4.5 Echo (`echo.html`, `js/echo.js`): real-time
1 descent from the icy world through an ice cave into the mine (tube geometry, ice material fading into rock); 2 first person in darkness: head bob tied to scroll, footstep and breathing sounds, dust motes, dripping water as positioned PannerNode sources; 3 sonar: spherical wavefront shader on every material (legacy `pinged()` in `legacy/web/echo-film.js`), echoes returned by raycasting 12 directions and scheduling delayed, quieter, positioned copies of the ping; 4 mine: Poly Haven rock textures, timber sets, rusted rails, a tipped mine cart (generated), hanging chains (instanced torus links), puddles that catch the ping; 5 the Listener (`assets/models/listener.glb`, animations Idle_Breathe / Walk_Stalk / Alert_Listen / Sleep_Dormant): moves only between pings so each ping shows it closer; head bone turns toward the camera when you ping; 6 the scare: hold your breath → breathing stops, heartbeat rises, silence, one last ping, then `assets/models/jumpscare.glb` ("Jumpscare_Caught", 3.958 s, camera keys from its Blender script reproduced in `legacy/web/echo-film.js`), violent shake, `scare.mp3`, red chromatic flash; 7 warning about the jump scare and red flash, sound off by default, Ping button; 8 how the game works, the Listener's hunting loop (patrol → listen → investigate → chase → lose you), 18 commits, 1st prize best overall, Play Echo link, exact credit line. Reduced motion: still image instead of the scare.

### 4.6 Credits (`credits.html`)
Table of every asset: name, creator, source URL, licence. Start from section 6.

---

## 5. Shared UI checklist
Frosted header with HUD font, adapts to section tone (`data-tone="dark"`), hides on scroll down. Buttons with frost-spread fill, sliding underlines, tilt cards with moving specular. Cursor ring (off on touch). Sound toggle in the header; wind + crystal clicks on icy pages. Skip link. Credits link in the footer.

---

## 6. Assets

### 6.1 Already in the repo
| Asset | Where | Source | Licence |
|---|---|---|---|
| Snow field (pure sky) HDRI 1k | assets/textures/snow.hdr | Poly Haven, "snow_field_puresky" | CC0 |
| Snow 02 diffuse/normal/roughness 1k | assets/textures/snow_*.jpg | Poly Haven, "snow_02" | CC0 |
| Belfast sunset (pure sky) HDRI 2k, aerial grass, asphalt 02, brushed concrete | inside assets/sky-core.json | Poly Haven | CC0 |
| Boeing 747SP geometry (SOFIA) | assets/models/b747.glb, sky-core.json | NASA 3D Resources, github.com/nasa/NASA-3D-Resources ("3D Printing/SOFIA") | NASA media, public domain (not endorsed by NASA) |
| The Listener + jump-scare model and animation | assets/models/listener.glb, jumpscare.glb, echo-core/echo-scare.json | Shreyansh's team, github.com/BurTheBear/HackHaven | CC0 per the repo's CREDITS |
| Cave textures (dark_rock_02, rock_face_04, brown_mud_03, weathered_planks), rocks rock_07/09 | echo-core.json | Poly Haven via the HackHaven repo | CC0 |
| Bones, skull, ribcage props | echo-core.json | KayKit (Kay Lousberg) via the HackHaven repo | CC0 |
| Echo sounds (ping, drone, heartbeat, hiss, step, scare mix) | echo-core.json | HackHaven repo, from CC0 Freesound recordings | CC0 |
| Sky Sentry radio voices | assets/audio/l*.mp3, sky-audio.json | Generated with Kokoro-82M (hexgrad), voices am_michael (pilot), am_onyx (tower), af_heart (alert) | Apache-2.0 model; output free to use |
| Engine, wind, explosion, thump, alarm | assets/audio/*.mp3 | Synthesised with ffmpeg | own work |
| Fonts Unbounded, Geist, Geist Mono, Big Shoulders, Big Shoulders Stencil, Special Elite | Google Fonts | Google Fonts | SIL OFL 1.1 |
| three.js r147, GSAP 3.13 (+ScrollTrigger, SplitText), Lenis 1.1.18 | js/vendor | npm | MIT; GSAP "Standard" no-charge licence |

### 6.2 Free assets to fetch next (direct download, no login)
Poly Haven (CC0, `https://dl.polyhaven.org/file/ph-assets/...`): HDRIs `kloofendal_overcast_puresky`, `snow_field_2_puresky`, `frozen_lake` (winter/overcast), a dawn sky for Sky Sentry; textures `snow_field_aerial`, `asphalt_snow`, `snow_01`/`snow_03`, `long_white_tiles` (pool), `metal_grate_rusty`, `green_metal_rust`, `oak_wood_planks`; models `industrial_storage_cart`, `barrel_03`, `modular_industrial_pipes_01`. ambientCG (CC0): Ice00x, Snow00x, Rock0xx, Rust00x, Tiles (pool) at 2K.
New TTS lines (Kokoro, same voices): tower "Skyline nine-zero-two heavy, go around, birds on final." ; alert "Bird activity on final approach. Risk high." ; pilot "Going around, Skyline nine-zero-two heavy."

### 6.3 Assets that need Shreyansh's logins (free ones only, credit each)
Sketchfab (filter: downloadable, CC-BY or CC0): an airliner with a full cockpit interior, rigged/animated gull or Canada goose with flap and glide cycles, a quadcopter drone, a mine cart, a modern school or aquatic-centre building, a control tower interior. Mixamo (free with Adobe login, royalty-free in projects): seated controllers (typing/talking idle), pilots (sitting), a swimmer (freestyle). Fab / Quixel Megascans (free tier): scanned snow, ice, rock, rotting timber, rusted metal. Faces must stay fictional.
Process: Shreyansh signs in on the built-in browser; downloads land on his computer; stage them into the container with the device tools, convert with gltf-transform (resize textures, Draco/Meshopt), add to the Credits page.

---

## 7. Blender film kit (for when Shreyansh is on his GPU machine)
Write `blender/build_pool.py`, `blender/build_sky.py`, `blender/build_echo_descent.py`, run with `blender -b -P blender/build_X.py -- --out renders/X`.
Settings for every film: Cycles, GPU (OptiX/CUDA/Metal), 512–1024 samples with adaptive sampling, OpenImageDenoise, AgX view transform (Medium High Contrast), Nishita sky where outdoors, volumetrics for clouds/light shafts, motion blur 0.5 shutter, DOF on the hero subject, 1920×1080 desktop and a separate 1080×1920 portrait camera, 24 fps.
Export: PNG sequence → `ffmpeg -i f_%04d.png -c:v libaom-av1 -crf 30 -g 1` (all-intra AV1) or AVIF/WebP frames chunked 48 per folder with `manifest.json` (see section 3).
Scenes: **pool** (melt → underwater pool → refreeze; caustics need light-path caustics on, refractive water); **sky** (cockpit cruise, cloud descent, breakout, chase, flock, tower, go-around; split into 8 shots matching 4.4); **echo descent** (ice cave → mine, ~6 s).

---

## 8. How to run and deploy
Run locally: `python3 -m http.server 8080` in the repo root, open http://localhost:8080 (JSON/HDR assets need http, not file://).
Deploy: Netlify → "Add new site" → import this GitHub repo (publish directory `.`, no build command) or drag the folder onto app.netlify.com/drop.

---

## 9. Reusable code in `legacy/` (previous dark build)
- `legacy/web/sky-film.js`: 747 livery shader (object-space stripes, windows, cockpit), landing gear, runway textures (threshold piano keys, "27", centreline, touchdown and aiming-point marks), edge/threshold/approach/PAPI lights, windsock, tree billboards, detailed control tower (`towerExterior`, `towerRoof`, interior consoles), realistic monitors and STARS-style radar drawing, Sky Sentry HUD screen, phone-on-tripod camera with live feed render target, geese built in code, fire/smoke particles, crash, dips between cuts, HDRI rotation so the sun sits where you want, Kokoro voice playback.
- `legacy/web/echo-film.js`: procedural mine tunnel (tube with noise, flattened floor, rock and mud materials), timber sets, rails and sleepers, chalk marks, lanterns, `pinged()` sonar material patch, Listener animation states, the jump-scare camera/light keys copied from the asset's Blender script.
- `legacy/web/medals3d.js`: struck medals (relief → normal map, reeded edge, enamel, ribbons). `legacy/web/story3d.js`: scroll walkthrough engine and props (pool, tower, server rack, stack light, database, etc.).
- `legacy/generators/*.py`: the old canvas page generators (content text lives here too: home.py, sky3d.py, echo3d.py).
- `legacy/tools/*.py`: Playwright screenshot harnesses.

---

## 10. Verification checklist (brief section 10)
Real browser, scroll every page fully both directions; no console errors; 1440 / 768 / 390 widths; reduced motion; contrast AA on Snow (ink #0F1B26 and slate #66788A both pass on #F4F7FA at body sizes); focus states; alt text; heading order; load size per page; frame rate on a laptop.

---

## Appendix A: the original brief (verbatim)

See `docs/original-prompt.md` (identical copy). Reproduced here:

```markdown
# Prompt: Redesign my portfolio as an icy, immersive, film-quality site

Redesign my personal portfolio (Shreyansh Nikam) as an immersive, award-level website. The target feel is the Igloo Inc site (igloo.inc, Awwwards Developer Site of the Year 2024): a near-monochrome icy world, one 3D hero object per section, a camera that travels as you scroll, white-flash transitions, and objects that dissolve into particles. Use that site only as inspiration for the feel. Don't copy its code, models, name, logo or penguin characters. Everything must be original.

Keep all of my existing content (listed below), the four pages (About me, Projects, Sky Sentry, Echo) and the credit lines word for word.

Don't reuse or restyle any existing animation. Rebuild every animation on every page from scratch. Each page should feel like you've stepped into another world: real scale, real depth, real light, cinematic camera work. Get as close to a movie render as possible. A flat scene with things sliding across it is not acceptable.

## 1. Colour palette: icy white
Nearly monochrome and cold. Use only these colours:
- Snow #F4F7FA: main background
- Frost #E7EEF4: secondary surfaces, cards
- Glacier #CAD7E2: lines, borders, grid
- Ice blue #A9CBE3: ice tint for 3D and glows
- Deep ice #5E8AAB: deep shadow inside ice
- Polar ink #0F1B26: main text
- Slate #66788A: secondary text, HUD labels
- Pure white #FFFFFF: specular highlights, bloom
- Signal blue #2F6FE4: the ONE accent, for the main button and active state only

Rules:
- About 85% of the screen should be Snow, Frost and White. Ice blue appears only in 3D materials and glows.
- Signal blue is the only saturated colour. Use it once per screen, for the main call to action.
- Body text must meet WCAG AA contrast on Snow.
- The background is never pure flat white. Add a very soft radial gradient from Snow to Frost, plus fine film grain.
- Echo is the exception: it starts icy and descends into darkness.

## 2. Typography
- Display: a wide, cold, technical face, such as Unbounded or Syne. Use it for my name and big section titles: oversized, tight leading, slight negative tracking.
- Body: Geist (or Inter Tight), 17–18px, generous line height.
- HUD / labels: Geist Mono (or JetBrains Mono), 11–12px, uppercase, wide letter spacing. Put it in the screen corners: section numbers (01 / 07), coordinates, a scroll percentage, a live clock (America/New_York), and "LIVINGSTON, NJ".
- Each project page can keep its own display face (Sky Sentry: Big Shoulders; Echo: Big Shoulders Stencil + Special Elite).

## 3. Rendering approach: hybrid (film-quality + real-time)
Use two techniques and pick the right one for each scene:

A) PRE-RENDERED FILM, scrubbed by scroll (for fixed, story-driven scenes)
- Build and animate the scene in Blender and render with Cycles (or Unreal Engine's Path Tracer / Movie Render Queue).
- Full path tracing: global illumination, soft area-light shadows, real reflections and refractions, caustics (pool water, ice, glass), volumetric clouds and fog, subsurface scattering (skin, snow, ice), physically correct sun and sky (Nishita sky), motion blur, depth of field, lens effects.
- High sample counts with OpenImageDenoise, AgX or Filmic colour management, at least 1920×1080 for desktop and a separate 1080×1920 portrait version for phones.
- Export as an image sequence (AVIF/WebP, 24–30fps) or as a video encoded with a keyframe on every frame (all-intra H.264 or AV1) so scrubbing is smooth.
- On the site, draw the current frame to a canvas from scroll progress (GSAP ScrollTrigger scrub). Load frames progressively and preload the next chunk ahead of the visitor.
- Overlay live, real-time elements on top (HUD, detection boxes, text, particles) so it still feels interactive.

B) REAL-TIME 3D (for scenes the visitor interacts with)
- Three.js (or React Three Fiber + drei).
- Bake lighting from Cycles into lightmaps and ambient occlusion maps, and add light probes and HDRI reflections, so real-time scenes look as close to the film as possible.
- PBR materials, real shadows, ACES tone mapping, correct sRGB colour.

If you can't run Blender or Unreal yourself, still build everything else, and deliver:
- The .blend (or Unreal) scenes, or a Blender Python script that builds them, with cameras, lights, materials and animation set up.
- Exact render settings and commands to render each sequence.
- Placeholder frames wired into the site so I can drop the real renders in.

## 4. Stack
- GSAP + ScrollTrigger + SplitText for all timelines. Use scrub so scroll controls the camera and the film frames.
- Lenis smooth scroll, synced to ScrollTrigger through gsap.ticker.
- Real-time post-processing: soft bloom, film grain, vignette, very subtle chromatic aberration, depth of field, motion blur at speed.
- Spatial 3D audio with the Web Audio PannerNode (HRTF). Off by default, with a "Best with headphones" prompt to turn it on.
- It will be hosted on Netlify, so it has to be a static build. Host large frame sequences efficiently (compressed, chunked, cached).

## 5. Assets: use the best available
Use the highest-quality assets whose licence allows use on a public website. Credit every one on a Credits page.
- Sources to search first: Poly Haven (CC0 HDRIs, textures, models), ambientCG (CC0 PBR materials), Sketchfab (check CC-BY or the paid licence), Fab / Quixel Megascans, BlenderKit, TurboSquid / CGTrader (licensed), Mixamo (rigged people and animations).
- Airplane: a detailed airliner with a full interior cockpit, working landing lights, gear and flaps. Use a fictional livery: no real airline names or logos.
- Architecture: a realistic airport (runway with correct markings, approach lights, PAPI, taxiways, terminal, snow), a control tower with an interior, and a modern school or aquatic-centre building.
- People: realistic rigged humans with natural animation: pilots in the cockpit, controllers in the tower, and a swimmer. Keep faces fictional; never use real people's likeness.
- Birds: rigged, realistic birds (gulls or geese, which are real airport hazards) with proper flap and glide cycles.
- Drone: a realistic quadcopter with blinking navigation lights.
- Pool: a real competition pool with lane ropes, starting blocks, tiles, accurate water with caustics, and underwater light shafts.
- Mine (Echo): photoscanned rock, rotting timber, rusted rails and metal, a mine cart, chains, water.
- Ice and snow: high-resolution scanned snow and ice textures, plus procedural ice crystals.
- Sky and lighting: high-dynamic-range HDRIs for dawn, overcast and winter scenes.

## 6. The icy world (home and projects pages)
1. Ice materials: in real time, MeshPhysicalMaterial (or drei MeshTransmissionMaterial) with transmission ≈ 1, ior ≈ 1.31, thickness, roughness 0.05–0.2, an Ice blue attenuation colour, and a cold HDRI for reflections. In film renders, real refraction, caustics and subsurface scattering.
2. One hero object per section, floating gently (slow rotation, small bob), with plenty of empty space around it.
3. A scroll-driven camera: one continuous path (CatmullRomCurve3) through one connected icy world. Scroll moves the camera, so the page itself shouldn't feel like it's scrolling.
4. Particle dissolves: MeshSurfaceSampler turns a section's object into points. Curl noise blows them into snow or dust, which re-forms into the next object.
5. Transitions: white flash or noise dissolve between sections, through a fullscreen shader with a noise mask.
6. Background: a faint 3D grid or contour lines, drifting snow, soft fog, real atmospheric depth.
7. The world stays alive when you stop scrolling (idle wind, particles, breathing camera).

## 7. Page-by-page plan

### Preloader
A mono counter runs from 000 to 100 while a single ice crystal grows from a point. Then it flashes to white, and my name enters with SplitText (letters rise from below with a frosted blur).

### Home: About me (real-time icy world, with one pre-rendered section)
One continuous flight through the icy world. Each section is a new place the camera arrives at, not a block that fades in.

01 Hero
- A tall, refractive ice monolith floating over a misty snowfield.
- "Shreyansh Nikam." in the display face, with "Freshman at Livingston High School, New Jersey" above it in the HUD font.
- A rotating line: "I build" + [AI that warns airport towers about birds. / horror games you see with sound. / things that work end to end.]
- HUD stats: "awards this fall", "competitions, both with awards", "1st, prize, best overall".
- Buttons: "See my projects and achievements" (Signal blue) and "Read about me".
- A custom animated scroll cue: a thin line with a snowflake moving down it.

02 About me
- Title: "I build things that have to work when it matters."
- Body: "I'm Shreyansh Nikam, a freshman at Livingston High School in New Jersey. I swim on the LHS team, help lead our school's Hack Club, and spend weekends at hackathons and game jams with a few friends. This fall I helped build Sky Sentry, an early-warning system that spots birds and drones near a runway, and Echo, a horror game where sound is the only way to see. Together they won four awards at two competitions, including first prize for best overall."
- 3D: the monolith dissolves into snow, and the camera drifts down to the next scene.

03 The classroom
- Title: "A high-rigor public school, taken at the highest level open to me."
- "In 2025 the College Board placed Livingston High School on its AP School Honor Roll at the Platinum level, its highest tier."
- Four stats that count up, each frozen inside its own floating ice cube: 39 AP courses offered, 13 dual-enrollment courses, 5 academic pathways and selective programs, 474 AP Scholars in one year.
- Source line: "Sources: LHS School Profile 2024–2025. College Board, AP School Honor Roll, New Jersey, 2025."

04 How LHS levels its courses
- The camera flies along a glacier cross-section showing the three levels as layers: AP on top, then Honors, then College Prep.
- "Honors is the highest level a freshman can take. Four of my five are Honors."
- My schedule as a frosted-glass list: English 1 (Honors), Modern World History (Honors), Geometry (Honors), Biology (Honors), French 2 (College Prep).

05 Beyond the classroom (PRE-RENDERED pool film)
- "Practice in the pool. Code on weekends."
- Film: the ice surface melts into water and the camera drops beneath it into a real competition pool. A swimmer glides overhead, caustics ripple across the tiles, light shafts cut through bubbles. Then the camera rises and the water freezes back into ice.
- Three frosted cards: Athletics (LHS Swim), Leadership (LHS Hack Club, Vice President), Competitions (Hackathons and game jams).

06 Fall 2026: two competitions, four awards (signature moment, pinned)
- Pin this section. Four ice shards rotate in, one per award: BEST USE SOLANA, BEST USE TIGERDATA, OVERALL 5TH PLACE (Sky Sentry, HackPHS, October 2026) and 1ST PRIZE BEST OVERALL (Echo, Hack Club Haven Princeton, November 14 to 15, 2026).
- Links: "Watch the Sky Sentry film" and "Enter the Hollow".

07 How I work, then the outro
- 01 Any team, any stack. 02 End to end. 03 Tested before done. Keep the existing descriptions.
- Outro: "Two projects. One fall." plus "Watch Sky Sentry catch a flock before it reaches the runway, then walk into the mine from Echo."
- Final button: "See my projects and achievements".
- Footer: "Shreyansh Nikam, Livingston High School, New Jersey".

### Projects page (real-time)
- Two large ice blocks, Sky Sentry and Echo, floating in a real 3D space with refraction and depth. Each shows its awards etched inside it.
- On hover, a block widens, glows brighter and cracks slightly, while the other block dims.
- Choosing one sends the camera flying into it, which becomes the start of that project's world: the clouds for Sky Sentry, the ice cave descending into the mine for Echo.

### Sky Sentry page: PRE-RENDERED film, scrubbed by scroll, with live overlays
The visitor should feel like they're IN the sky, not watching a diagram. Render it like a movie.
1. Above the clouds: first person behind the cockpit glass at cruise altitude, pilots' hands on the controls. Pre-dawn winter sky with a physically correct sky, stars fading and a sun glow on the horizon. Instruments glow faintly. Engine hum.
2. Descent through clouds: the camera dives through path-traced volumetric clouds. Moisture streaks across the glass, the light flickers, and it whites out briefly.
3. Breakout: you burst out beneath the clouds over a snowy airport at dawn. City lights spread to the horizon. The runway is at real scale (about 3 km). Approach lights strobe toward the threshold, PAPI lights show red and white, and the airliner is on a real 3° glideslope at about 140 knots.
4. Chase cam: a cinematic chase view of the airliner. Landing lights cutting through mist, strobes, wingtip vortices, heat shimmer behind the engines.
5. The flock: 50+ realistic birds banking and swirling across the approach path. A drone hovers near the perimeter with blinking lights.
6. Detection (live overlay): cut to the Sky Sentry camera point of view, with sensor noise in the render. Real-time Signal blue boxes lock onto each bird with IDs and tracking lines, the approach corridor is projected over the footage, and the risk level climbs green → yellow → red.
7. The tower: inside the control tower, controllers at their screens, looking out at the runway. The alert panel lights up, the voice alert plays and an ATC radio call says "go around". The Gemini report types out (live) and the Solana stamp appears (live).
8. Go-around: engines spool up, the plane pitches up and climbs over the flock with camera shake, and you rise back into the clouds. Fade to white.
9. Then: how it works, my part, the awards (Best Use of Solana, Best Use of TigerData, 5th place overall), a link to the live site, and the credit line exactly: "Built with Atharv Sharma, Vivan Chowdhury, and Pranav Atreya at HackPHS 2026"

### Echo page: REAL-TIME (interactive), with Cycles-baked lighting
The visitor should feel trapped in a real abandoned mine where sound is the only way to see.
1. Descent: start in the icy world and go down through an ice cave into the mine. This transition can be a short pre-rendered film.
2. First person, total darkness: realistic head bob with footsteps, breathing that you hear, dust motes, dripping water positioned in 3D.
3. Real sonar: each ping sends an expanding spherical wavefront through a shader. It lights up the actual photoscanned geometry, with baked material detail, as it passes and fades slowly back to black. Echoes return with delays based on real distances, so far walls answer later and quieter.
4. Realistic mine: photoscanned rock walls, rotting timber supports, rusted rails, a tipped mine cart, chalk marks, hanging chains and water puddles that catch the ping.
5. The Listener: a high-detail rigged creature (original design) with skeletal animation and realistic skin. Between pings it moves when you can't see it, so each new ping shows it closer. It turns its head toward you with IK when you make sound.
6. The scare: you're told to hold your breath. Your breathing stops, a heartbeat rises, there's dead silence, one last ping... then it lunges into the camera with a violent shake, a distorted scream and a red chromatic flash.
7. Keep a warning before the scene that mentions the jump scare and the red flash. Keep sound off by default, and keep a Ping button for visitors.
8. Then: how the game works, the Listener's hunting loop, my 18 commits, 1st prize best overall, a Play Echo link to itch.io, and the credit line exactly: "Built with Atharv Sharma and Elias Chen at Hack Haven Princeton 2026"

## 8. Shared UI
- The header has the HUD font and frosted glass. It adapts its colours to each section (dark text on ice, light text in Echo's darkness and over films) and hides on scroll down, shows on scroll up.
- Hover micro-interactions: buttons get a frost-spread fill, links get a sliding underline, and cards tilt slightly with a moving specular highlight.
- Custom cursor: a small ring that grows over links. Off on touch devices.
- Sound on the icy pages: a soft wind ambience plus quiet crystal clicks on hover. Off by default, with a visible toggle.
- A Credits page listing every asset, its creator and its licence.

## 9. Craft rules (must follow)
- Animate only transform, opacity, clip-path and shader uniforms. Use power3/expo.out easing, never linear.
- Reveals take 0.6–1.2s. Text staggers are 0.03–0.08s per word or letter.
- Images and text reveal with a clip-path mask plus a slight scale-in. Headings reveal line by line.
- Never break native scrolling, keyboard navigation or anchor links. All text must be real HTML that's readable if JS or WebGL fails.
- Reduced motion (prefers-reduced-motion): no camera flights, particles, flashes or shake. Show a few still frames from each film with captions, and replace the jump scare with a still image.
- Performance: cap pixel ratio at 2, pause rendering when off-screen or the tab is hidden, compress models (Draco/Meshopt) and textures (KTX2), lazy-load each scene and each film chunk, and show a real preloader. Target 60fps on a laptop.
- Mobile: use the portrait film renders, fewer particles, baked fallbacks, but the same story beats and scroll reveals. No horizontal overflow at 390px.

## 10. Finish and verify
1. Run a design-guidelines and accessibility audit (contrast, focus states, alt text, headings).
2. Open every page in a real browser and scroll the WHOLE page. Confirm every animation and film fires, scrubbing is smooth in both directions, scrolling never sticks, and the console shows no errors.
3. Check at 1440px, 768px and 390px, and with reduced motion turned on.
4. Check load size and frame rate for each page.
5. Then report what was built, which fonts and assets were used (with licences), which renders still need to be made, and anything that couldn't be done.```
