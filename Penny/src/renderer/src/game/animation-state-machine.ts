export interface AnimationStateConfig {
  name: string;
  frames: number[];
  frameRate: number;
  loop: boolean;
  onComplete?: () => void;
}

export interface AnimationTransition {
  from: string;
  to: string;
  duration: number;
  easing?: (t: number) => number;
}

export class AnimationStateMachine {
  private states: Map<string, AnimationStateConfig>;
  private transitions: AnimationTransition[];
  private currentStateName: string;
  private currentTime: number;
  private currentFrameIndex: number;
  private isTransitioning: boolean;
  private transitionStartTime: number;
  private transitionDuration: number;
  private onStateChangeCallbacks: Array<(from: string, to: string) => void>;

  constructor(
    states: AnimationStateConfig[],
    transitions: AnimationTransition[]
  ) {
    this.states = new Map();
    states.forEach(state => {
      this.states.set(state.name, state);
    });
    
    this.transitions = transitions;
    this.currentStateName = states[0]?.name || '';
    this.currentTime = 0;
    this.currentFrameIndex = 0;
    this.isTransitioning = false;
    this.transitionStartTime = 0;
    this.transitionDuration = 0;
    this.onStateChangeCallbacks = [];
  }

  get currentState(): string {
    return this.currentStateName;
  }

  transitionTo(stateName: string): boolean {
    // Check if there's a valid transition from current state to target state
    const validTransition = this.transitions.find(
      t => t.from === this.currentStateName && t.to === stateName
    );

    if (!validTransition) {
      return false;
    }

    // Start the transition
    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.transitionDuration = validTransition.duration;
    
    // Invoke the state change callbacks
    this.onStateChangeCallbacks.forEach(callback => {
      callback(this.currentStateName, stateName);
    });

    this.currentStateName = stateName;
    return true;
  }

  forceState(stateName: string): void {
    // Immediately change state without transition
    const oldStateName = this.currentStateName;
    this.currentStateName = stateName;
    
    // Reset timing
    this.currentTime = 0;
    this.currentFrameIndex = 0;
    this.isTransitioning = false;
    
    // Invoke the state change callbacks
    this.onStateChangeCallbacks.forEach(callback => {
      callback(oldStateName, stateName);
    });
  }

  update(dt: number): void {
    if (this.isTransitioning) {
      // Check if transition is complete
      const elapsed = Date.now() - this.transitionStartTime;
      if (elapsed >= this.transitionDuration) {
        this.isTransitioning = false;
      }
    } else {
      // Update frame timing for current state
      const currentState = this.states.get(this.currentStateName);
      if (currentState) {
        this.currentTime += dt;
        const frameTime = 1000 / currentState.frameRate;
        const frameCount = currentState.frames.length;
        
        // Calculate current frame index properly
        const frameIndex = Math.floor(this.currentTime / frameTime);
        
        // Handle loop behavior
        if (frameIndex >= frameCount) {
          if (currentState.loop) {
            this.currentTime = (frameIndex % frameCount) * frameTime; // Reset to correct frame if looping
            this.currentFrameIndex = frameIndex % frameCount;
          } else {
            this.currentFrameIndex = frameCount - 1; // Stay on last frame
            this.currentTime = (frameCount - 1) * frameTime; // Freeze at last frame
          }
        } else {
          this.currentFrameIndex = frameIndex;
        }
      }
    }
  }

  getCurrentFrame(): number {
    const currentState = this.states.get(this.currentStateName);
    if (currentState && currentState.frames.length > 0) {
      return currentState.frames[this.currentFrameIndex];
    }
    return 0;
  }

  isTransitioning(): boolean {
    return this.isTransitioning;
  }

  onStateChange(callback: (from: string, to: string) => void): void {
    this.onStateChangeCallbacks.push(callback);
  }
}

// Default animation states
export const IDLE_DOWN = 'idle_down';
export const IDLE_UP = 'idle_up';
export const IDLE_LEFT = 'idle_left';
export const IDLE_RIGHT = 'idle_right';

export const WALK_DOWN = 'walk_down';
export const WALK_UP = 'walk_up';
export const WALK_LEFT = 'walk_left';
export const WALK_RIGHT = 'walk_right';

export const TYPING = 'typing';
export const SITTING = 'sitting';
export const TALKING = 'talking';
export const CELEBRATING = 'celebrating';
export const DRINKING = 'drinking';

// Default transitions
export const DEFAULT_TRANSITIONS: AnimationTransition[] = [
  // Idle to walk
  { from: IDLE_DOWN, to: WALK_DOWN, duration: 200 },
  { from: IDLE_UP, to: WALK_UP, duration: 200 },
  { from: IDLE_LEFT, to: WALK_LEFT, duration: 200 },
  { from: IDLE_RIGHT, to: WALK_RIGHT, duration: 200 },
  
  // Walk to idle
  { from: WALK_DOWN, to: IDLE_DOWN, duration: 200 },
  { from: WALK_UP, to: IDLE_UP, duration: 200 },
  { from: WALK_LEFT, to: IDLE_LEFT, duration: 200 },
  { from: WALK_RIGHT, to: IDLE_RIGHT, duration: 200 },
  
  // Idle to other states
  { from: IDLE_DOWN, to: TYPING, duration: 300 },
  { from: IDLE_UP, to: TYPING, duration: 300 },
  { from: IDLE_LEFT, to: TYPING, duration: 300 },
  { from: IDLE_RIGHT, to: TYPING, duration: 300 },
  
  { from: IDLE_DOWN, to: SITTING, duration: 300 },
  { from: IDLE_UP, to: SITTING, duration: 300 },
  { from: IDLE_LEFT, to: SITTING, duration: 300 },
  { from: IDLE_RIGHT, to: SITTING, duration: 300 },
  
  { from: IDLE_DOWN, to: TALKING, duration: 300 },
  { from: IDLE_UP, to: TALKING, duration: 300 },
  { from: IDLE_LEFT, to: TALKING, duration: 300 },
  { from: IDLE_RIGHT, to: TALKING, duration: 300 },
  
  { from: IDLE_DOWN, to: CELEBRATING, duration: 300 },
  { from: IDLE_UP, to: CELEBRATING, duration: 300 },
  { from: IDLE_LEFT, to: CELEBRATING, duration: 300 },
  { from: IDLE_RIGHT, to: CELEBRATING, duration: 300 },
  
  { from: IDLE_DOWN, to: DRINKING, duration: 300 },
  { from: IDLE_UP, to: DRINKING, duration: 300 },
  { from: IDLE_LEFT, to: DRINKING, duration: 300 },
  { from: IDLE_RIGHT, to: DRINKING, duration: 300 },
  
  // Other state transitions
  { from: TYPING, to: IDLE_DOWN, duration: 300 },
  { from: SITTING, to: IDLE_DOWN, duration: 300 },
  { from: TALKING, to: IDLE_DOWN, duration: 300 },
  { from: CELEBRATING, to: IDLE_DOWN, duration: 300 },
  { from: DRINKING, to: IDLE_DOWN, duration: 300 },
];