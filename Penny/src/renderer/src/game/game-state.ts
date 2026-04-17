// RPG Layer 0a: Core game state data model
// Foundation for separating game logic from Phaser rendering

export interface AnimationState {
  current: string;
  frame: number;
  loop: boolean;
  speed: number;
}

export interface DialogState {
  speakerId: string;
  text: string;
  options: string[];
  portrait: string;
}

export interface Prop {
  id: string;
  type: 'decorative' | 'interactive' | 'animated';
  position: { x: number; y: number };
  sprite: string;
  interactionRadius: number;
}

export interface WorldState {
  currentScene: string;
  time: {
    hour: number;
    minute: number;
    dayPhase: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
    season: 'spring' | 'summer' | 'autumn' | 'winter';
  };
  weather: string;
}

export interface PlayerState {
  position: { x: number; y: number; scene: string };
  direction: 'up' | 'down' | 'left' | 'right';
  inventory: string[];
  equipped: string[];
  stats: {
    xp: number;
    level: number;
    credits: number;
  };
}

export interface AgentGameState {
  position: { x: number; y: number };
  animationState: AnimationState;
  mood: string;
  activity: string;
  dialog: DialogState | null;
  stats: {
    xp: number;
    level: number;
    credits: number;
  };
}

export interface RoomState {
  bounds: { x: number; y: number; width: number; height: number };
  agents: string[];
  props: Prop[];
  lighting: string;
}

export interface QuestState {
  status: 'available' | 'active' | 'complete' | 'failed';
  issueNumber: number;
  podId: string | null;
  rewards: {
    xp: number;
    credits: number;
  };
}

export interface UIState {
  questLogOpen: boolean;
  inventoryOpen: boolean;
  dialogActive: boolean;
  notifications: string[];
}

export interface GameState {
  world: WorldState;
  player: PlayerState;
  agents: Record<string, AgentGameState>;
  rooms: Record<string, RoomState>;
  quests: Record<string, QuestState>;
  ui: UIState;
}
