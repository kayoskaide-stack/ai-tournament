BRAIN TRUST — COSMOS COMMAND DECK v2
MASTER IMPLEMENTATION SPECIFICATION

PURPOSE
Build an optional, premium, futuristic Brain Trust interface/skin that feels like a living cosmic observatory and luxury interstellar command deck rather than a conventional web app.

The interface must preserve the existing Brain Trust application, providers, chat, IRC relay, project tools, and current skins. Cosmos Command Deck is an additional skin/experience, not a destructive redesign.

----------------------------------------------------------------------
1. CORE VISUAL CONCEPT
----------------------------------------------------------------------

The user enters Brain Trust and sees a full-screen immersive environment:

• A deep-space / Milky Way / nebula environment fills the background.
• Stars exist at multiple depth layers and move with subtle parallax.
• Some particles drift sideways.
• Some particles travel toward the viewer.
• Occasional shooting stars cross the scene.
• A subtle premium starship / observatory architectural layer is blended into the environment.
• The interface is dark, elegant, glassy, luminous, and spatial.
• Lighting, reflections, soft shadows, atmospheric glow, and depth should create a high-resolution “advanced desktop / sci-fi command deck” feeling.
• The design must be original and must not directly copy any copyrighted movie, game, or franchise UI.

The experience should feel like:
- a futuristic observatory,
- a luxury starship,
- a high-end Linux desktop,
- a real-time command center,
- and a playful 3D navigation system.

----------------------------------------------------------------------
2. CENTRAL FLOATING CUBE
----------------------------------------------------------------------

The centerpiece is a floating 3D cube used for navigation.

The cube must:

• Remain permanently tilted at a visually pleasing angle.
• Never look perfectly flat or front-facing when idle.
• Have a slight “planet on an axis” feeling.
• Have a playful floating-object feeling similar to classic 3D menu objects.
• Gently bob and drift even when untouched.
• Slowly rotate by itself while idle.
• Support free drag rotation.
• Support flick gestures.
• Preserve angular momentum after a flick.
• Gradually slow naturally with damping.
• Rotate on multiple axes, not only left/right.
• Remain fun to spin even when the user is not trying to navigate.

Suggested default idle orientation:
- slight X-axis tilt,
- slight Z-axis roll,
- slow Y-axis rotation.

Cube faces:
1. Arena
2. Projects
3. Providers
4. IRC
5. Tools
6. Settings

Each face should have:
- subtle glass/translucent depth,
- glowing border,
- concise label,
- optional live status indicator,
- subtle surface scan/reflection.

----------------------------------------------------------------------
3. CUBE SELECTION / MATERIALIZATION
----------------------------------------------------------------------

When a face is selected:

1. Reduce or arrest the cube’s current angular momentum smoothly.
2. Determine the intended face.
3. Rotate the cube so that face comes toward the viewer.
4. Preserve a small stylish tilt rather than making the cube perfectly flat.
5. Move the cube toward the camera in 3D.
6. Increase glow and depth.
7. Materialize the selected interface from the cube face.

The materialization should feel deliberate rather than instant.

Desired effects:
- blur resolving into clarity,
- panel expansion,
- scan-light sweep,
- subtle glow bloom,
- glass panel formation,
- slight menu-show-delay feeling,
- soft depth transition.

When the panel closes:
- the interface collapses back,
- cube retreats into space,
- free-floating physics resume.

----------------------------------------------------------------------
4. COSMOS BACKGROUND
----------------------------------------------------------------------

The cosmos is not a static wallpaper.

Use multiple layers:

Layer A: distant stars
- very slow movement
- tiny points
- faint parallax

Layer B: mid-depth stars
- slightly faster movement
- subtle twinkle

Layer C: near particles
- occasional streaks
- some moving toward camera
- some drifting across viewport

Layer D: atmospheric space
- faint nebula / Milky Way haze
- gentle gradients
- subtle volumetric feeling without heavy rendering cost

Layer E: occasional phenomena
- shooting stars
- meteor-like streaks
- faint lens glints
- orbital rings
- subtle energy arcs

The background should feel alive without becoming visually noisy.

----------------------------------------------------------------------
5. FUTURISTIC STARSHIP / OBSERVATORY SKIN
----------------------------------------------------------------------

The cosmos should be integrated into a luxury futuristic environment.

Visual language:
- curved structural forms
- elegant glass surfaces
- illuminated architectural edges
- cyan / blue / violet / soft gold accents
- dark metallic surfaces
- subtle reflections
- polished depth
- environmental lighting
- translucent data panes

Avoid:
- generic gaming HUD clutter
- military cockpit overload
- direct franchise copying
- neon overload
- unreadable tiny text everywhere

----------------------------------------------------------------------
6. ORIGINAL LIVING ATRIUM / TREE FEATURE
----------------------------------------------------------------------

Include an original indoor living-atrium visual element.

Possible design:
- tall futuristic glass chamber
- luminous indoor tree
- softly glowing leaves
- subtle environmental lighting
- elegant futuristic planter / platform
- faint atmospheric particles
- architectural framing

The tree must be original and should not duplicate a specific movie prop or set.

The atrium can live:
- in the right-side background,
- inside a dedicated side panel,
- or as a visible architectural section of the ship interior.

----------------------------------------------------------------------
7. LIVE CHAT MUST REMAIN VISIBLE
----------------------------------------------------------------------

The Brain Trust chat must remain visible while the cube and cosmos animate.

This is a core requirement.

The chat should:
- use a translucent glass pane,
- remain readable,
- remain connected to the actual Brain Trust message stream,
- update independently of graphics,
- not pause when the cube spins,
- not reset when menus animate,
- scroll normally,
- preserve existing message behavior.

Architecture:
Graphics and chat are separate layers.

REAL APP EVENTS
     ↓
live chat / provider status / IRC state

GRAPHICS ENGINE
     ↓
cube physics / particles / cosmos / panel animation

The two systems must operate independently.

----------------------------------------------------------------------
8. REAL-TIME CUBE FACE ACTIVITY
----------------------------------------------------------------------

Cube faces may display concise real-time state.

Examples:
- ● LIVE
- +2 messages
- unread count
- provider online/offline
- rate limited
- relay connected
- current project activity
- subtle face pulse on incoming message

A new message may cause:
- Arena face border pulse,
- tiny LIVE dot flash,
- unread badge increment,
- soft glow animation.

The cube must not need to stop rotating for these indicators to update.

----------------------------------------------------------------------
9. HUD DATA AROUND THE CUBE
----------------------------------------------------------------------

Surround the cube with elegant, sparse, readable HUD panels.

TOP LEFT — DATE / TIME
Show:
- current local time
- date
- day of week
- timezone
- UTC offset
- optional UTC time

The time should update live.

TOP RIGHT — ASTRONOMY
Show:
- real moon phase
- illumination percentage
- moon icon/graphic
- moon age if available
- optional next full/new moon
- optional sunrise/sunset later

BOTTOM LEFT — BRAIN TRUST STATUS
Show:
- current room/channel
- IRC relay state
- provider count
- activity state
- unread count
- last message / live indicator

BOTTOM RIGHT — SYSTEM / TELEMETRY
Potential real values:
- latency
- message queue
- provider availability
- relay state
- render/FPS estimate
- animation mode
- network state

Optional decorative values may be used, but they must never be presented deceptively as real if they are simulated.

----------------------------------------------------------------------
10. LIVE DATE / TIME / MOON DATA
----------------------------------------------------------------------

Use real values in the integrated app where practical.

Date/time:
- browser/local system time
- live updates
- correct timezone display

Moon:
- calculate locally or query a suitable source
- phase label
- illumination percentage
- visual moon representation

The data should feel like part of the command-deck instrumentation.

----------------------------------------------------------------------
11. CHAT PANEL DESIGN
----------------------------------------------------------------------

Suggested style:
- translucent dark glass
- frosted blur
- thin luminous edge
- subtle inner shadow
- readable monospaced or technical font
- color-coded nicks
- soft animated activity glow

The chat pane should visually coexist with the cube.

On mobile:
- bottom or lower-left placement
- enough height for actual conversation
- must not be completely covered by the cube
- safe-area aware
- adjustable/collapsible later if desired

----------------------------------------------------------------------
12. MOBILE-FIRST INTERACTION
----------------------------------------------------------------------

Primary target: iPhone.

Requirements:
- pointer/touch gesture support
- smooth drag
- reliable flick velocity
- safe-area support
- no accidental page scrolling while manipulating cube
- readable font sizes
- large enough tap targets
- no tiny precision controls
- graceful resizing
- portrait-first design
- landscape support where practical

----------------------------------------------------------------------
13. PERFORMANCE STRATEGY
----------------------------------------------------------------------

The interface should look advanced without overheating the phone.

Use:
- HTML/CSS for chat, text, HUD, controls
- CSS 3D for cube if sufficient
- JavaScript for physics/state
- requestAnimationFrame for animation
- lightweight Canvas/WebGL only where it provides real value
- Three.js only if justified for cosmos/particles

Avoid:
- rendering all text in WebGL
- huge particle counts
- excessive blur layers
- massive box-shadow stacks
- unnecessary reflow/layout thrashing
- continuous expensive DOM measurements

Performance controls:
- cap particles
- lower quality on smaller/weaker devices
- reduced-motion mode
- adaptive particle count
- disable expensive optional effects if FPS drops
- pause/reduce animation when tab is hidden
- preserve battery

----------------------------------------------------------------------
14. ACCESSIBILITY / FALLBACKS
----------------------------------------------------------------------

Support:
- prefers-reduced-motion
- lower-motion fallback
- static 2D fallback if 3D becomes unsupported
- readable contrast
- keyboard-accessible controls where practical
- semantic HTML for real app UI

The skin should never block access to core Brain Trust functionality.

----------------------------------------------------------------------
15. EXISTING APP MUST BE PRESERVED
----------------------------------------------------------------------

Cosmos Command Deck must be optional.

Keep existing skins such as:
- Midnight IRC
- Classic mIRC
- Amber terminal
- Matrix green

Add:
- Cosmos Command Deck

Switching back to another skin must restore the regular interface cleanly.

Do not break:
- live chat
- provider status
- IRC relay
- projects
- build console
- media tools
- auth
- existing commands
- existing layouts

----------------------------------------------------------------------
16. REPOSITORY SAFETY
----------------------------------------------------------------------

Before editing:
1. inspect the actual repository tree
2. identify exact files
3. use only valid paths
4. do not invent placeholder paths
5. do not edit filename.js/example.js/path/to/file.js unless those files really exist
6. keep changes isolated
7. prefer dedicated Cosmos CSS/JS modules
8. preserve current app behavior
9. preview before production
10. use corrective retries if a coding model proposes nonexistent edit paths

Suggested implementation approach:
- add dedicated cosmos skin CSS
- add dedicated cube/physics JS module
- add optional background scene module
- hook into existing skin selector
- connect to existing chat/provider state rather than duplicating app logic

----------------------------------------------------------------------
17. REAL-TIME EVENT ARCHITECTURE
----------------------------------------------------------------------

The skin must consume existing app events instead of inventing a parallel chat system.

Conceptual event flow:

Brain Trust / IRC / Providers
        ↓
Existing application state/event layer
        ↓
 ┌─────────────────────┬──────────────────────┐
 │ Chat renderer        │ Cosmos skin widgets  │
 │ messages             │ status / cube badges│
 └─────────────────────┴──────────────────────┘

Graphics must never become the source of truth.

----------------------------------------------------------------------
18. OPTIONAL LIVE EFFECTS
----------------------------------------------------------------------

Incoming message:
- Arena face pulse
- unread badge
- chat glass edge glow

Provider status change:
- Providers face status update
- subtle color change

IRC relay reconnect:
- IRC face animation

New project activity:
- Projects face badge

Voice mode:
- Arena face audio pulse/ring

----------------------------------------------------------------------
19. VISUAL QUALITY TARGET
----------------------------------------------------------------------

The result should feel:
- polished
- cinematic
- technically impressive
- spatial
- smooth
- premium
- readable
- interactive
- alive

It should NOT feel like:
- a gimmicky landing page
- a tech demo disconnected from the app
- a toy cube
- a generic gamer HUD
- a copied movie interface

----------------------------------------------------------------------
20. ACCEPTANCE CRITERIA
----------------------------------------------------------------------

The prototype/integration is successful when:

✓ cube is visibly tilted
✓ cube floats while idle
✓ cube rotates automatically
✓ drag rotates freely
✓ flick creates inertia
✓ angular momentum decays naturally
✓ cosmos shows clear depth
✓ stars and particles move independently
✓ occasional shooting stars appear
✓ live chat remains readable while cube animates
✓ real app messages can update independently
✓ date/time HUD is live
✓ moon data appears
✓ Brain Trust/provider/IRC status is visible
✓ living atrium/tree element exists
✓ selected cube face aligns and approaches viewer
✓ menu materializes smoothly
✓ iPhone performance remains practical
✓ reduced-motion fallback exists
✓ existing skins remain intact
✓ existing Brain Trust behavior is preserved

----------------------------------------------------------------------
21. PRIORITY ORDER
----------------------------------------------------------------------

If tradeoffs are necessary, preserve in this order:

1. Real Brain Trust functionality
2. Readable live chat
3. Floating tilted cube physics
4. Cosmos atmosphere
5. Smooth iPhone performance
6. HUD live data
7. Starship architecture
8. Atrium/tree
9. Extra visual effects

----------------------------------------------------------------------
22. FINAL DESIGN INTENT
----------------------------------------------------------------------

The user should feel like Brain Trust exists inside a living cosmic command environment.

The interface should communicate:

“this is not just a chat page.”

It should feel like a real-time command observatory where:
- AIs are active,
- messages arrive live,
- systems update around the user,
- the navigation object floats in space,
- the environment is alive,
- and the user is operating the whole system from the center of it.

Working title:
BRAIN TRUST — COSMOS COMMAND DECK v2
