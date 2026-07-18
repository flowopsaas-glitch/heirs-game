# HEIRS — Production Design & Technical Brief

**Original IP. Open-world crime/action. Third-person. Squad-based tactical combat.**

---

## 1. CORE FANTASY

You are not a hero. You are a bloodline. You control whoever currently leads the Mortara family — a mid-tier criminal dynasty clawing for permanence in Santo Porto, a port city that has already eaten a dozen families like yours. The city resists you not through some singular antagonist, but through its *memory*: every faction tracks not just your organization but *which specific person* pulled the trigger, broke the deal, or showed mercy. Your goal isn't to "win" — it's to make the family name outlast any single body carrying it. The tension is that the open-world genre's core pleasure (being *someone* in a living city) is the exact thing you're forced to risk every time you commit to a job.

---

## 2. WORLD & SETTING

### The City: Santo Porto
**Era:** Present-day, fictional Mediterranean/Atlantic port city — sun-bleached docks, brutalist midtown glass, narrow old-town alleys stained with decades of rainfall.  
**Geography:** Crescent-shaped, hugging a deep natural harbor. Built vertically on old volcanic hills on one side, flat industrial sprawl on the other.

### Districts (4 core, expandable to 6)

| District | Visual Identity | Gameplay Purpose |
|----------|----------------|------------------|
| **THE NARROWS** | Tight vertical streets, hanging laundry, crumbling plaster over stone. Warm amber streetlights at night. | Player home territory. Low law enforcement, high civilian density. Recruitment and safe houses. Starting ground. |
| **PORTO DOCKS** | Steel containers, sodium-vapor orange lighting, oily water reflections. Industrial cranes silhouetted against sunset. | Smuggling economy, Voss family stronghold. High-value raids. Claustrophobic combat encounters between shipping containers. |
| **MIDTOWN** | Clean glass facades, blue-white corporate lighting, manicured public spaces that feel surveilled. | Money laundering, Corsini family territory. High law enforcement, high reward. Stealth-favored gameplay. |
| **THE FURNACE** | Abandoned steel mills, rust everywhere, fire barrel gatherings. Red-shifted twilight palette. No working streetlights. | Neutral ground. Black market. Deals, ambushes, and the hardest combat encounters. No police, no rules. |

### Living City Systems
- **NPC Memory:** Every named NPC tracks which crew member they've seen, what that member did, and their emotional response. This persists permanently across sessions.
- **Day/Night Behavior:** Civilian density drops 70% at night; gang activity rises. Midtown locks down (security patrols). The Furnace only *activates* after dark.
- **Faction AI:** Voss and Corsini run their own operations on timers independent of the player. If left alone, they expand. Territory is not static.
- **Reputation Specificity:** The game never tracks "player reputation" — it tracks *Elena's* reputation, *Rico's* reputation. When Elena dies and Rico takes over, NPCs react to *Rico* based on what *Rico* did, not what Elena did. Blood debts partially transfer; personal respect does not.

---

## 3. CORE GAMEPLAY LOOP

### Moment-to-Moment (60 seconds)
Driving through The Narrows at dusk. Radio chatter from your lieutenant about Voss movement at the docks. Pull over near a known informant — their dialogue changes because *last time you talked to them, your brother Rico threatened their cousin.* Get intel on a supply cache. Mark it for the next job. Keep driving. Choose: scout the target now (risk being spotted, gain tactical advantage at planning time) or head home and plan blind.

### Session Structure (30-60 minutes)
1. **Roam phase** (~10 min): Gather intel, build relationships, scout, manage crew
2. **Planning phase** (~5 min): Receive/accept a job. Lock in loadouts, stances, orders for each member. THIS IS THE COMMITMENT — you cannot change anything once locked.
3. **Execution phase** (~3 min): Watch your plan play out in real-time tactical combat. React with only pre-planned fallback orders.
4. **Aftermath** (~5 min): Resolve consequences. Collect rewards. Process any deaths. If leader dies — succession cutscene, city reacts, new leader inherits the mess.
5. **Return to roam** with the world permanently changed.

### THE SIGNATURE MECHANIC: Commit-Based Tactical Planning with Narrative Permadeath

Before any firefight, you lock in loadouts and squad orders and **cannot adjust mid-combat**. This forces planning over reflexes. Combined with **permanent character death inside a persistent open world where the city tracks WHO did WHAT** — this creates a game where a single bad plan has cascading narrative consequences for potentially dozens of hours of future play.

No other game combines all three: open-world freedom + commit-based tactics + narrative permadeath with tracked individual identity.

---

## 4. COMBAT & TRAVERSAL SYSTEMS

### Movement
- **On foot:** Responsive, slightly weighty. 0.1s input-to-full-speed. No floaty feeling. Characters lean into turns. Sprint stamina exists but is generous.
- **Vehicles:** Arcade-weighted. Cars have noticeable mass (0.3s acceleration curve) but are forgiving on handling. Not sim, not kart. *Satisfying slide on wet roads at night.*
- **Traversal connection:** Vehicles aren't just transport — getaway driving is part of mission aftermath. Car condition persists (shot-up cars attract police). Driving into enemy territory in a known vehicle is a reputation risk.

### Combat
- **Commit-based:** All tactical decisions locked before engagement. Mid-combat, the AI executes your orders. You watch, experience consequences.
- **Weapon categories:** Pistol (reliable), SMG (suppression), Shotgun (close devastation), Rifle (range), Knife (silent but lethal range)
- **Stance system:** Aggressive/Defensive/Flanking/Overwatch/Stealth — each modifies hit chance, dodge chance, and target priority
- **Enemy AI tiers:** 
  - Lookouts (low HP, flee early)
  - Soldiers (standard combat loop)
  - Enforcers (high HP, aggressive)
  - Lieutenants (tactical, use cover, coordinate others)
- **Difficulty scaling:** Enemy composition changes, not bullet-sponge HP inflation. Harder missions have more Lieutenants and better-armed Enforcers.

### Combat-to-World Connection
Every kill is witnessed and attributed. Combat in a populated area = more witnesses = faster reputation change = more consequences. Silenced weapons reduce witness radius. District heat rises after combat, affecting future operations in that area for real-time hours.

---

## 5. PROGRESSION & STAKES

### What You're Building (20-40 hours)
- **Crew roster:** Recruit, train, and emotionally invest in 4-8 members simultaneously
- **Territory:** Control districts by eliminating rival presence and establishing operations
- **Reputation web:** Per-character, per-faction standing that opens/closes specific opportunities
- **Wealth:** Funds operations, better equipment, safe houses, bribes
- **Family Legacy:** A permanent record of every major deed — viewable as a timeline

### Consequence Systems
- **Permadeath:** Character death is permanent. No reload. No resurrection.
- **Succession:** Heir takes over. Their personal reputation becomes the new "face" of the family. NPCs who respected the old leader don't automatically respect the new one.
- **Grudge transfer:** Blood debts partially transfer to the family; personal earned trust dies with the person.
- **Territory decay:** Uncontrolled or contested territory generates less income and attracts rivals.
- **Loss feeling:** Designed as *story advancing*, not punishment. The succession screen frames death as a narrative beat, not a failure state.

### Mission Structure
- **Authored core missions:** 8-12 hand-crafted heists/jobs with unique tactical puzzles
- **Systemic jobs:** Generated from faction AI state (rival is moving cargo → intercept opportunity; informant has info → extraction mission)
- **Emergent situations:** Faction AI creates conflicts the player can exploit, ignore, or get caught in

---

## 6. ART DIRECTION

### Visual Reference (Original Palette)
- **Lighting:** Volumetric with strong motivated sources. Streetlamps cast cones with visible atmospheric dust. Night scenes are *actually dark* with pools of light, not blue-filtered daylight.
- **Color grading:** Desaturated earth tones as base (ochre, rust, concrete grey). Accent colors per district — warm amber (Narrows), cold sodium orange (Docks), sterile blue-white (Midtown), deep red-shift (Furnace).
- **Silhouette language:** Characters read by body shape and posture, not just costume. The Mortara family dresses functional-dark; Voss wear industrial/workwear; Corsini wear clean lines and expensive fabric.
- **Weather:** Rain is a gameplay modifier (reduces visibility, muffles sound) and a mood tool. Fog rolls in from the harbor at dawn.

### Tone
- **Grounded**, not satirical. No winking at the camera. Violence has weight — screen shake, audio compression, moment of silence after a death.
- **Dark but not nihilistic.** The succession mechanic itself is the game saying: "loss is part of the story, not the end of it."
- **Human scale.** No superpowers, no sci-fi, no supernatural. The drama comes from human decisions and their permanent consequences.

---

## 7. TECHNICAL SCOPE

### Target Engine: Unreal Engine 5
**Why:** Nanite/Lumen for the dense urban environment with real-time GI. World Partition for open-world streaming. Mature AI behavior tree system. Industry-standard for the genre's visual target.

### Minimum Viable Vertical Slice (First Build)

**Build FIRST (3 systems):**
1. **Commit-based combat** — Planning UI + locked order execution + permadeath resolution. This is the novel mechanic. Prove it's fun.
2. **One district roaming** — The Narrows only. Movement, NPCs, basic interaction. Prove the world feels alive enough.
3. **Succession trigger** — One death → control passes → city reacts. Prove the emotional beat works.

**Explicitly OUT of scope for first slice:**
- Full 4-district city
- Vehicle combat
- Faction AI autonomy
- Full economic simulation
- Multiplayer of any kind
- Character customization

### Team & Timeline (Vertical Slice Only)
- **Team:** 5-8 people (1 designer, 2 gameplay programmers, 1 AI programmer, 1-2 environment artists, 1 UI/UX, 1 narrative)
- **Timeline:** 4-5 months for playable vertical slice
- **Budget tier:** Mid-indie ($500K-$1M for slice; full production $5-15M)

---

## 8. WHAT MAKES THIS WORTH BUILDING

**Pitch deck sentence:**

> *"Every open-world crime game promises you're someone in a living city — HEIRS is the first one where losing that someone IS the game, not the end of it."*

The market gap: GTA gives freedom with no real stakes. XCOM gives stakes with no persistent world. Darkest Dungeon gives permadeath with no city that remembers your face. Nobody has put *earned, narrative permadeath* inside a persistent open world where the city itself tracks which of your people pulled the trigger. HEIRS sits at that intersection and owns it.

---

## CONSTRAINTS
- **Platform:** PC primary, console secondary
- **Team:** Small studio (5-15)
- **Timeline:** 12-18 months to shippable Early Access; 24-30 months to 1.0
- **Tone reference (original):** Mediterranean port city, present day, the golden hour before a storm — sun still beautiful, pressure dropping, everyone knows something's about to break
