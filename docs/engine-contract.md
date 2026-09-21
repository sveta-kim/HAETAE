# HAETAE runtime contract

Browser-native ES modules, no external dependencies. Logical canvas 960 × 540; world coordinates in logical pixels. Simulation uses seconds and fixed 1/60 updates. Korean user-facing language. No assets requiring network.

## Shared interface

`src/game.js` exports `Game` class. `new Game({ onEvent(event), saveProgress(data) })`. Constructor starts an attract scene at level 0 with `mode='title'`. Methods: `startNew()`, `continueGame(save)`, `update(dt,input)`, `pause()`, `resume()`, `retry()`, `choose(value)`, `selectTalisman(index)`, `getSave()`. `choose` supports `destroy` / `restore` for core choice; `protect` / `extort` for NPC. `saveProgress` receives a JSON-safe checkpoint only on meaningful progress. `onEvent` receives `{type:'sound',name}` or `{type:'notice',text}`.

Input each update: `{left,right,jump,attack,enhancedAttack,dash,cast,enchant,interact,select,cycle,aim}`. Mouse attack/enhancedAttack may be held (engine rate limits); keyboard/touch actions are edges. `aim` is a logical 960×540 canvas point or null; engine adds camera offset. `cycle` is a signed slot delta; wheel selection wraps through unlocked slots in numeric order, skipping locked slots (direct selection may still preview a locked slot). `select` is 0–4 or null. Pause is handled by UI. Mouse/wheel capture is limited to the playing canvas; browser dialogs and Ctrl+wheel are untouched.

## Render state (public fields on game)

- `mode`: title | playing | paused | dead | choice | npc | ending
- `time`, `levelIndex` (0–3), `camera` numeric horizontal world offset, `worldWidth`
- `level`: `{name,subtitle,objective,theme}`; theme moat/archive/kernel/escape
- `player`: `{x,y,w:24,h:44,vx,vy,facing:1|-1,hp,maxHp,energy,maxEnergy,grounded,invulnerable,dashTime,attackTime,combo,buff:null|{id,remaining},enchantCooldown,selected,unlocked:[0,1],tigerEvolved:false}`. x/y top left. Talisman index 0 red,1 blue,2 white,3 black,4 gold. Buff IDs use string names `red`, `blue`, `white`, `black`; initial HP is 150.
- `platforms`: `[{x,y,w,h,hidden?:boolean,moving?:boolean}]`; solidity of hidden platforms decided by engine; renderer checks `scanTime`.
- `enemies`: `[{id,type,name,x,y,w,h,hp,maxHp,facing,attackTime,alert,dead,phase?,timer?,tails?}]`; types pabal/sunra/dokkaebi/shield/bulgasari/jangseung/jangsan/sagwan/gumiho/root; bosses have `boss:true`.
- `objects`: `[{id,type,x,y,w,h,active,label?,value?}]`; types memory/talisman/cooler/gate/checkpoint/npc/log/exit/core; active=false means consumed.
- `projectiles`: `[{x,y,w,h,vx,vy,hostile,color,life,playerShot?,damage?,source?,buff?,action?}]`; swept AABB resolves the nearest collision with solid platforms, active world props and actors. Scans do not use projectiles. Tutorial shots are isolated and preexisting shots freeze until practice ends.
- `effects`: `[{type,x,y,life,maxLife,color,radius?,facing?}]`; optional particles. Renderer must tolerate unknown effect types.
- `conscience` 0–100, `stats`: `{kills,memories,logs,damageTaken,time}`, `scanTime`, `shieldTime`, `castCooldown`, `objective` string, `hint` string, `message` string, `messageTime`
- `boss`: active enemy or null; `escapeWall`: numeric world x or null; `route`: null | destroy | restore
- `ending`: null or `{id:'black'|'white'|'gray',title,badge,text,report:[string]}`
- `checkpoint`: internal object. `saveVersion=1`.

`src/renderer.js` exports `Renderer`: constructor(canvas), `render(game)` drawing a full canvas frame; `resize()` if needed. Use canvas.width=960, height=540. Safe in title state. Renderer does not manipulate UI, audio, engine or input. Optional `setReducedMotion(boolean)`.

`src/content.js` may be owned by engine implementer; UI uses its own small talisman labels if needed. Engine must not import renderer, audio, browser DOM or main.

## Gameplay and balancing

Four compact complete levels, not a single demo screen. Double jump; movement-direction dash; aimed projectile combo; selected cast and timed enchant with exact 30s cooldown after expiration. 15s red/white, 12s blue/black, evolved white 30s. Red damages civilian records (-5); gate demolition -2; NPC extortion -20; combat alone never lowers conscience. Boss-specific mechanics: bulgasari cooler overload, jangsan scan truth, gumiho scanned critical removes 3 of 9 tails, root boss leads to route choice. Core choice then escape before ending, white restore>=75, gray restore<75, black destroy. Scaled-down implementation of campaign allowed, explicitly document simplifications. No shell execution of command names.

Each stage checkpoint restores a coherent state and unlocked talismans. Invalid save data must be rejected safely. No impossible gaps; first tutorial jump safe/recoverable. Door exit must gate on all stage bosses dead. NPC choice must allow returning to gameplay. Engine tests should simulate progression and verify route endings and cooldown semantics.
