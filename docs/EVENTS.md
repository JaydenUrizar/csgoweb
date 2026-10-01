## move piece additions
`slide {actor,speed}`, `mantle {actor,height}`; `footstep`/`land`/`jump` carry `surface`, `speed`, `crouch`, `walk`, `foot`.

## flow additions (src/match)
`round:reset {n}`, `halftime {kind,swapped,scores}`, `match:start`, `match:pause|resume`, `team:change {actor,from,to}`, `actor:respawn {actor}`, `buy:refund|buy:drop`, `beacon:armCancel|disarmCancel|disarmed|beep`; `beacon:arm`/`beacon:disarm` mean "started", `beacon:armed`/`beacon:disarmed` mean "finished". Full list: docs/pieces/flow.md.
