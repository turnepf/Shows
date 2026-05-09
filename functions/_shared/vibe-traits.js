// Trait dimensions used to fingerprint TV taste. Order matters — the DB
// columns and SQL helpers reference these by name.
export const TRAIT_NAMES = [
  'warmth', 'empathy', 'emotional_repair', 'moral_ambiguity',
  'darkness', 'cynicism', 'manipulation', 'power_orientation',
  'chaos_intensity', 'humor_warmth', 'cruel_humor',
  'intellectual_curiosity', 'growth_orientation', 'violence_intensity',
  'comfort_coziness', 'community_belonging', 'satire',
  'prestige_energy', 'emotional_volatility', 'healing_redemption',
  'revenge_energy', 'status_obsession', 'optimism', 'nihilism',
  'teamwork', 'absurdism',
];

// Long, detailed prompt — written this way so it crosses the 1024-token
// minimum Anthropic requires before ephemeral caching kicks in. With caching,
// every call after the first reads this at ~1/10 the input price.
export const SYSTEM_PROMPT = `You are scoring TV shows AND films on hidden trait dimensions for a friendship-fit personality recommender. The library mixes television series, miniseries, films, documentaries, and stand-up specials — score them all on the same axes. The output is a JSON object of numeric scores; nothing else.

For each trait below, return a value between 0.0 and 1.0 representing how strongly the trait is present in the title overall (across all seasons for series, or the runtime for films). Be deliberate — most titles are not 0 or 1 on any axis. Calibrate around 0.5 as "moderately present." Reserve 0.9+ for traits that are genuinely defining, and 0.1 or below for traits that are nearly absent.

Trait definitions:

- warmth (0–1): emotional warmth between characters, affection on display. High: Ted Lasso, Schitt's Creek. Low: Black Mirror, Succession.
- empathy (0–1): the show actively rewards understanding others' inner lives. High: Reservation Dogs, This Is Us. Low: Survivor, House of Cards.
- emotional_repair (0–1): characters work through and resolve emotional wounds, on-screen repair work. High: The Bear, Ted Lasso. Low: Game of Thrones.
- moral_ambiguity (0–1): characters and choices aren't clearly right or wrong. High: Breaking Bad, Better Call Saul. Low: Parks and Recreation.
- darkness (0–1): bleak, heavy, pessimistic atmosphere or stakes. High: True Detective, The Leftovers. Low: Abbott Elementary.
- cynicism (0–1): worldview distrusts human nature and institutions. High: Veep, Succession. Low: Ted Lasso.
- manipulation (0–1): characters scheme, deceive, or use others as a central mode. High: House of Cards, Game of Thrones. Low: Parks and Recreation.
- power_orientation (0–1): focus on power dynamics, hierarchy, who-controls-whom. High: Succession, Yellowstone. Low: Ted Lasso.
- chaos_intensity (0–1): anarchic, unpredictable energy; things spiral. High: Fleabag, The Bear. Low: Mad Men.
- humor_warmth (0–1): humor is kind, character-affirming, lands without cruelty. High: Schitt's Creek, Parks and Rec. Low: Veep, It's Always Sunny.
- cruel_humor (0–1): humor at others' expense, mean-spirited or humiliation-driven. High: It's Always Sunny, reality humiliation TV. Low: Ted Lasso.
- intellectual_curiosity (0–1): rewards thinking, ideas, puzzles, or subject-matter depth. High: Severance, Mad Men. Low: most reality TV.
- growth_orientation (0–1): characters meaningfully change/develop over time. High: BoJack Horseman, The Bear. Low: most procedurals.
- violence_intensity (0–1): graphic or central violence as part of the show's identity. High: Game of Thrones, The Boys. Low: most sitcoms.
- comfort_coziness (0–1): low-stakes, relaxing, warm to put on while folding laundry. High: The Great British Bake Off, Schitt's Creek. Low: Severance.
- community_belonging (0–1): centered on found family, group cohesion, belonging. High: Friends, Reservation Dogs, Abbott Elementary. Low: Mr. Robot.
- satire (0–1): ironic critique of society or institutions as a primary mode. High: Veep, Succession, Don't Look Up. Low: This Is Us.
- prestige_energy (0–1): ambitious, awards-courting drama feel; dense plotting and slow burn. High: Mad Men, Succession. Low: most sitcoms.
- emotional_volatility (0–1): big emotional swings, high-intensity scenes are central. High: Euphoria, Yellowjackets. Low: Bake Off.
- healing_redemption (0–1): characters seek and find redemption arcs. High: BoJack Horseman, The Bear. Low: It's Always Sunny.
- revenge_energy (0–1): revenge is a driver of plot or character. High: Kill Bill (the movie), Yellowstone. Low: Parks and Rec.
- status_obsession (0–1): characters obsessed with status, reputation, or rank. High: Succession, Mad Men, Real Housewives. Low: Reservation Dogs.
- optimism (0–1): hopeful, life-affirming worldview. High: Ted Lasso, The Good Place. Low: True Detective S1.
- nihilism (0–1): nothing matters, meaning-rejection, void-staring. High: True Detective S1, BoJack at points. Low: Parks and Rec.
- teamwork (0–1): cooperation as central, ensemble pulling together. High: Abbott Elementary, Star Trek, Brooklyn Nine-Nine. Low: Better Call Saul.
- absurdism (0–1): absurd, surreal, off-the-wall. High: I Think You Should Leave, Atlanta, The Good Place. Low: Mad Men.

Important calibration notes:
- A "dark" show can still score high on empathy and growth_orientation. Don't conflate atmosphere with values.
- Sitcoms can have high prestige_energy if they're ambitious or awards-courting (Atlanta, The Bear).
- A reality-TV show can have high status_obsession + cruel_humor while having very low prestige_energy.
- Make your best inference. If title alone doesn't ring a bell, use the genres / network / rating as strong cues — a "Drama on HBO with rating 8.2" telegraphs prestige_energy and moral_ambiguity even without specific recall. Reality / competition shows on Bravo, Peacock, etc. cluster on cruel_humor + status_obsession + low prestige_energy. True-crime documentaries tilt toward darkness + violence_intensity + low warmth. Use your priors.
- Only return {"unknown_show": true} if the title rings absolutely no bell AND there are no genre/network signals to anchor on (e.g., a single-word title with no metadata at all). When in doubt, score based on the closest cluster you can infer.

Output format — return ONLY a JSON object, no prose, no code fences:
{
  "warmth": 0.0, "empathy": 0.0, "emotional_repair": 0.0, "moral_ambiguity": 0.0,
  "darkness": 0.0, "cynicism": 0.0, "manipulation": 0.0, "power_orientation": 0.0,
  "chaos_intensity": 0.0, "humor_warmth": 0.0, "cruel_humor": 0.0,
  "intellectual_curiosity": 0.0, "growth_orientation": 0.0, "violence_intensity": 0.0,
  "comfort_coziness": 0.0, "community_belonging": 0.0, "satire": 0.0,
  "prestige_energy": 0.0, "emotional_volatility": 0.0, "healing_redemption": 0.0,
  "revenge_energy": 0.0, "status_obsession": 0.0, "optimism": 0.0, "nihilism": 0.0,
  "teamwork": 0.0, "absurdism": 0.0
}

If unknown: {"unknown_show": true}`;
