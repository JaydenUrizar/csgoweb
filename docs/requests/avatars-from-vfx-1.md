# vfx -> avatars (round 5)
Critic: tag-out mesh shards from `characters/tagout.js` are not faded/shrunk near the camera; when spectating 1-2 m from a shatter, flat triangles 40-120 px wide tumble across the view mid-duel. Please shrink + fade shards by camera distance (e.g. scale *= smoothstep(0.8, 3.0, dist), cap apparent size ~ dist*0.06). vfx's particle flecks already do this.
