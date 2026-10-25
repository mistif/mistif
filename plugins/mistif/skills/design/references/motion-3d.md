# Pages with a 3D scene or heavy motion

Read this only when the brief asks for WebGL, a 3D model, scroll-driven scenes or a lot of animation. Everything else in `SKILL.md` still applies.

## Whether to use 3D at all

Use it when the product is a physical object people would want to turn around and the scene is the main reason to visit. Skip it for informational pages, anything people scan quickly, and audiences on weak phones. A drawn SVG or a few photographs beats a slow canvas. If the scene fails to load, the page must still sell the product.

## Words over the scene

Three builds of one brief all put headings on top of bright objects, and one lost a heading under the header. So:

- Give each scene a text lane: the model sits in the other half of the frame, or a soft dark panel sits behind the words. Never rely on luck about where a planet or lamp happens to be.
- The fixed header gets a solid or blurred backing. A gradient that fades to nothing lets headings and prices run through the wordmark. Check at 390 and 768 px.
- Screenshot every scene boundary at 390 and 1440 px and read the words in each one.

## Scroll story

Write a scene table before coding: scene, scroll range, camera move, what text appears, what leaves. One scroll value drives the camera and the text, so they cannot drift apart. Pinned scenes get a stated height, and the last scene releases the pin cleanly into the normal page. Pricing, forms and footers sit outside the pin on a plain background.

Reduced motion means a different layout, not a slower one: cut between still views, drop the pin, stop every loop, keep a toggle in the header.

## Robustness of the canvas

- Pin the library version, say why in a comment, add an integrity hash, and prefer a build that will not vanish from the CDN.
- Cap the pixel ratio (about 2, lower on phones), turn antialiasing on for small screens where thin engraving shows, and step quality down when frames run long.
- Stop rendering when the tab is hidden or the canvas is fully covered by another section.
- Handle context loss and a missing context: show the designed static version (a drawn SVG of the object plus the full text), never a blank frame or an overlap of text on the drawing. Test with the context forced to null.
- Dispose of what you replace. A configurator that rebuilds the model must free the old one.

## Preloader and cursor

The preloader tells the truth about progress, ends the moment assets are ready, and has a time limit after which the page opens anyway. A short enforced minimum is fine; a long one is theatre. A custom cursor runs only for a fine pointer, never replaces the system cursor on form fields, and leaves the focus ring alone. Every magnetic or hover effect needs a keyboard and touch equivalent.

## Fonts and offline

Self-host the display and text faces (a small woff2 each) so a double-clicked `index.html` looks right with no network. Say in the notes what still needs the network.

## Measuring

Software rendering (SwiftShader) runs at 1 to 2 frames per second and shows half-faded scenes; do not judge motion with it. Use the real GPU, record frames per second at rest and mid-scroll plus the worst frame, and report which GPU. Test the phone width with real mobile emulation.

## Looks flat or plastic

A scene that reads as a toy usually lacks light, not geometry. Before calling it done, check each:

- Lights: one key light with a direction, one soft fill or rim from the other side, a little ambient. A single flat light, or none, gives a cardboard look.
- Materials: set roughness and metalness for what the object is made of (polished brass: metalness high, roughness 0.2 to 0.4; stone or paper: metalness 0, roughness high). Default grey, unlit or pure-white materials read as plastic.
- Environment: give metal something to reflect (an environment map or a few bright panels). Metal with nothing to reflect looks black or grey.
- Shadows: let the main object cast and receive a soft shadow, or add a contact shadow, so it sits in the scene.
- Scale and detail: bevels, small parts and slight wear beat large smooth primitives. Give each object one detail only it would have.
- Then look at a still frame at 390 and 1440 px, as a stranger would, before reporting.

## Headings caught mid-transition

Check a frame taken in the middle of each reveal and scene change. A heading that is cut off, half-faded over a bright object or hidden by a band means the transition needs a longer overlap, a mask that finishes before the words start, or text that stays whole while only the scene moves.
