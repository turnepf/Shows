import { TRAIT_NAMES } from './vibe-traits.js';

// Each cluster has a target trait vector. Traits not specified default to 0.5.
// A member's cluster = highest cosine similarity between their fingerprint
// and these targets.
function vec(overrides) {
  const v = {};
  for (const t of TRAIT_NAMES) v[t] = 0.5;
  return Object.assign(v, overrides);
}

export const CLUSTERS = [
  {
    id: 'curious_omnivore',
    name: 'Curious Omnivore',
    tagline: "You watch broadly: prestige drama, sci-fi, and comfort sitcoms in roughly equal measure.",
    target: vec({
      intellectual_curiosity: 0.85, moral_ambiguity: 0.65, emotional_volatility: 0.55,
      warmth: 0.55, empathy: 0.65, humor_warmth: 0.6, prestige_energy: 0.65,
      growth_orientation: 0.65, comfort_coziness: 0.5,
    }),
  },
  {
    id: 'warm_comfort',
    name: 'Warm Comfort Viewer',
    tagline: "Your taste leans into warmth, found-family stories, and shows that feel like a soft blanket.",
    target: vec({
      warmth: 0.85, comfort_coziness: 0.85, community_belonging: 0.8,
      humor_warmth: 0.8, optimism: 0.8, empathy: 0.75, healing_redemption: 0.65,
      darkness: 0.2, cynicism: 0.2, cruel_humor: 0.1, nihilism: 0.1,
    }),
  },
  {
    id: 'prestige_drama',
    name: 'Prestige Drama Loyalist',
    tagline: "Slow-burn ambition, dense plotting, morally ambiguous lead characters. You came for the craft.",
    target: vec({
      prestige_energy: 0.9, moral_ambiguity: 0.85, emotional_volatility: 0.7,
      darkness: 0.65, intellectual_curiosity: 0.7, cynicism: 0.55,
      chaos_intensity: 0.4, absurdism: 0.2, comfort_coziness: 0.2, humor_warmth: 0.4,
    }),
  },
  {
    id: 'dark_complexity',
    name: 'Dark Complexity Seeker',
    tagline: "Heavy, morally complicated stories — but with empathy underneath, not nihilism.",
    target: vec({
      darkness: 0.85, moral_ambiguity: 0.85, violence_intensity: 0.7,
      empathy: 0.7, cynicism: 0.6, intellectual_curiosity: 0.7,
      emotional_volatility: 0.7, comfort_coziness: 0.2, warmth: 0.3,
    }),
  },
  {
    id: 'satirical_cynic',
    name: 'Satirical Cynic',
    tagline: "Sharp, ironic, distrustful of institutions. Humor at the expense of the powerful.",
    target: vec({
      satire: 0.85, cynicism: 0.8, cruel_humor: 0.7,
      intellectual_curiosity: 0.7, absurdism: 0.55, prestige_energy: 0.6,
      warmth: 0.3, humor_warmth: 0.3, comfort_coziness: 0.3,
    }),
  },
  {
    id: 'power_game',
    name: 'Power Game Watcher',
    tagline: "Hierarchies, status, who-controls-whom. You like watching ambitious people scheme.",
    target: vec({
      power_orientation: 0.85, status_obsession: 0.85, manipulation: 0.75,
      moral_ambiguity: 0.7, prestige_energy: 0.65, cynicism: 0.65,
      warmth: 0.25, comfort_coziness: 0.15, empathy: 0.4,
    }),
  },
  {
    id: 'chaos_goblin',
    name: 'Chaos Goblin',
    tagline: "Here for the unhinged, the absurd, the emotionally chaotic. Big swings only.",
    target: vec({
      chaos_intensity: 0.85, absurdism: 0.85, emotional_volatility: 0.75,
      humor_warmth: 0.5, cruel_humor: 0.55, comfort_coziness: 0.2,
    }),
  },
  {
    id: 'empathy_healing',
    name: 'Empathy & Healing Viewer',
    tagline: "Stories of people working through emotional wounds, finding redemption, building chosen family.",
    target: vec({
      empathy: 0.85, healing_redemption: 0.85, emotional_repair: 0.85,
      community_belonging: 0.8, warmth: 0.75, growth_orientation: 0.8,
      darkness: 0.3, cruel_humor: 0.1, cynicism: 0.2,
    }),
  },
];
