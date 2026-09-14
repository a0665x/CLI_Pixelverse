# 3D village

The default Three.js village shares Agent lifecycle events and room assignments
with the optional Phaser 2D view. The event API, adapters and roster stay shared.

## Assets and installation

Village geometry, furniture and surface textures are authored in project code.
Honey is a Meshy-generated rabbit with a locally authored 25-joint rig. Retain its
CC BY 4.0 attribution included beside the GLB. Blender and paid assets are not
required to run 3D. The full 2D office art uses an optional licensed Modern Office
ZIP; see [office-assets.md](office-assets.md).

## Inspector and camera

WASD controls camera-relative movement and facing, including when blocked.
R cycles walk/hop/bound at 1.8/3.4/5.6 units per second. These are arcade speeds
with bounded animation strides. L equips the flashlight.

Space jumps. Indoor height uses continuous velocity and gravity with substeps
no larger than 1/120 second. Seats, sofa parts, beds and shelf/cabinet tops support
landing. Move on platforms and in the air; jump again after landing to climb.
Walking off an edge falls naturally. Walls and non-climbable workstations block
movement. Switching to 2D returns the inspector to the last ground position.

Overview controls: left-drag pan, right-drag orbit, cursor-centered wheel zoom.
Inspector zoom spans 2–60 units. Occluded inspectors use a screen-space position
marker instead of a white partial-body mask. Meteor arrival accelerates downward
and leaves debris, a shockwave and cracks fading over four seconds.

## Agent behavior and interaction

Agents navigate a cached half-unit graph using the inspector's body collision.
Assignments are destinations, not unchecked render coordinates. Swept movement
follows floor routes; facing and walking animation follow actual displacement.
Agents stand at safe workstation approaches without an unconditional seating lift.

Approach to reveal interaction choices. Movement keeps keyboard priority.
Press Enter to focus the menu, then left/right and Enter, or click directly.
Summaries show public hook events. Steer and interrupt require a bound control
connection; hook-only terminals are observable but cannot be taken over.

## Verification

Run `npm ci`, `npm test`, and `npm run build` inside `pixelworld_mvp`.
Tests cover real GLB skinning, body-aware navigation, platform landing, heading,
room geometry and view switching. Screenshots are product examples, not hardware
performance benchmarks. Extreme close-up bounding still exposes some deformation
around the fused source mesh's vest/forelimbs.
