1. **Create laser-vfx.ts file**  
   - Path: `Penny/src/renderer/src/game/laser-vfx.ts`  
   - Implement class `LaserVFX` with methods: `init()`, `playBeam()`, `playRetract()`, `playShatter()`  
   - Load assets: `laser_head.png`, `laser_beam.png`, `laser_outlet.png`, `laser_end_start_end_effect_01-04`  
   - Add additive blend for glow effect  

2. **Modify pod-foundry-scene.ts**  
   - Path: `Penny/src/renderer/src/game/pod-foundry-scene.ts`  
   - Import `LaserVFX`  
   - Add `laserVfx: LaserVFX` instance  
   - In `updatePodPhase()` method, detect "executing" and "self-fixing" phases  
   - On phase enter, call `laserVfx.playBeam()`  
   - On phase complete, call `laserVfx.playRetract()`  
   - On failure, call `laserVfx.playShatter()`  

3. **Update scene logic to position laser components**  
   - Use `LAB_PROP_FRAMES.LASER_HEAD`, `LAB_PROP_FRAMES.LASER_BEAM`, `LAB_PROP_FRAMES.LASER_OUTLET`  
   - Position laser head between reviewer and executor stations  
   - Dynamically stretch beam sprite to match distance between stations  

4. **Add sound effect trigger**  
   - In `playBeam()` method, trigger sound at start of animation  
   - Check audio enabled state before playing  

5. **Implement animation sequences**  
   - For beam extension: scale tween on x-axis from 0 to full length  
   - For endpoint effects: play 4-frame animation at both ends  
   - For glow: use alpha pulse or additive blend on beam  
   - For failure: tint beam red and play particle shatter effect  

6. **Ensure visibility conditions**  
   - Only render laser during "executing" and "self-fixing" phases  
   - Hide all laser components outside these phases  

7. **Test and validate**  
   - Confirm laser head, beam, and outlet are positioned correctly  
   - Validate all animation sequences play in correct order  
   - Verify sound triggers on beam start  
   - Confirm failure path shows red shatter effect  
   - Validate phase-based visibility logic works correctly