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
5. Then report what was built, which fonts and assets were used (with licences), which renders still need to be made, and anything that couldn't be done.