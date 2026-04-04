/**
 * Agent name themes — character packs from sci-fi, TV, and mythology.
 * Each theme maps role keys to a character with name, franchise, and one-line description.
 */

export interface AgentCharacter {
  name: string;
  franchise: string;
  description: string;
}

export type AgentThemeMap = Record<string, AgentCharacter>;

export const AGENT_THEMES: Record<string, AgentThemeMap> = {
  mythology: {
    planner: { name: "Athena", franchise: "Greek Mythology", description: "Goddess of wisdom and strategic warfare" },
    architect: { name: "Hephaestus", franchise: "Greek Mythology", description: "God of the forge and master craftsman" },
    implementer: { name: "Prometheus", franchise: "Greek Mythology", description: "Titan who brought fire and foresight to humanity" },
    tester: { name: "Nemesis", franchise: "Greek Mythology", description: "Goddess of retribution who ensures nothing goes unchecked" },
    coder: { name: "Pygmalion", franchise: "Greek Mythology", description: "Sculptor who brought his creation to life" },
    qa: { name: "Argus", franchise: "Greek Mythology", description: "Hundred-eyed giant who sees everything" },
    reviewer: { name: "Momus", franchise: "Greek Mythology", description: "God of satire and sharp-eyed criticism" },
    visual: { name: "Apollo", franchise: "Greek Mythology", description: "God of light, art, and aesthetic perfection" }
  },

  norse: {
    planner: { name: "Odin", franchise: "Norse Mythology", description: "Allfather who sacrificed an eye for wisdom" },
    architect: { name: "Mimir", franchise: "Norse Mythology", description: "Wisest of the Aesir, keeper of knowledge" },
    implementer: { name: "Thor", franchise: "Norse Mythology", description: "God of thunder who gets things done with force" },
    tester: { name: "Forseti", franchise: "Norse Mythology", description: "God of justice and truth" },
    coder: { name: "Wayland", franchise: "Norse Mythology", description: "Legendary smith who forges the impossible" },
    qa: { name: "Heimdall", franchise: "Norse Mythology", description: "Guardian who watches all nine realms" },
    reviewer: { name: "Tyr", franchise: "Norse Mythology", description: "God of law who sacrificed his hand for order" },
    visual: { name: "Freya", franchise: "Norse Mythology", description: "Goddess of beauty and refinement" }
  },

  "star-trek-tos": {
    planner: { name: "Kirk", franchise: "Star Trek: TOS", description: "Bold captain who leads from the front" },
    architect: { name: "Scotty", franchise: "Star Trek: TOS", description: "Miracle worker who keeps the ship together" },
    implementer: { name: "Spock", franchise: "Star Trek: TOS", description: "Half-Vulcan driven by pure logic" },
    tester: { name: "McCoy", franchise: "Star Trek: TOS", description: "Doctor who questions everything with passion" },
    coder: { name: "Uhura", franchise: "Star Trek: TOS", description: "Communications expert who bridges all systems" },
    qa: { name: "Sulu", franchise: "Star Trek: TOS", description: "Steady helmsman who never misses a course correction" },
    reviewer: { name: "Chekov", franchise: "Star Trek: TOS", description: "Sharp navigator who double-checks every calculation" },
    visual: { name: "Chapel", franchise: "Star Trek: TOS", description: "Nurse with an eye for what needs attention" }
  },

  "star-trek-tng": {
    planner: { name: "Picard", franchise: "Star Trek: TNG", description: "Diplomat captain who leads with principle and eloquence" },
    architect: { name: "LaForge", franchise: "Star Trek: TNG", description: "Chief engineer who sees what others can't" },
    implementer: { name: "Riker", franchise: "Star Trek: TNG", description: "First officer who turns plans into action" },
    tester: { name: "Data", franchise: "Star Trek: TNG", description: "Android who tests every assumption with precision" },
    coder: { name: "Wesley", franchise: "Star Trek: TNG", description: "Prodigy who writes solutions nobody expected" },
    qa: { name: "Worf", franchise: "Star Trek: TNG", description: "Security chief who tolerates zero defects" },
    reviewer: { name: "Troi", franchise: "Star Trek: TNG", description: "Empath who senses what's really going on" },
    visual: { name: "Guinan", franchise: "Star Trek: TNG", description: "Bartender sage with timeless perspective" }
  },

  "star-trek-ds9": {
    planner: { name: "Sisko", franchise: "Star Trek: DS9", description: "Commander who builds from the ground up" },
    architect: { name: "O'Brien", franchise: "Star Trek: DS9", description: "Chief of operations who fixes everything" },
    implementer: { name: "Kira", franchise: "Star Trek: DS9", description: "Former resistance fighter who executes with conviction" },
    tester: { name: "Odo", franchise: "Star Trek: DS9", description: "Shapeshifter constable who finds every flaw" },
    coder: { name: "Dax", franchise: "Star Trek: DS9", description: "Joined Trill with lifetimes of experience" },
    qa: { name: "Bashir", franchise: "Star Trek: DS9", description: "Enhanced doctor who catches what others miss" },
    reviewer: { name: "Garak", franchise: "Star Trek: DS9", description: "Tailor-spy whose reviews are lethally precise" },
    visual: { name: "Quark", franchise: "Star Trek: DS9", description: "Ferengi who knows exactly how things should look to sell" }
  },

  "star-trek-voyager": {
    planner: { name: "Janeway", franchise: "Star Trek: Voyager", description: "Captain who finds a way home against all odds" },
    architect: { name: "B'Elanna", franchise: "Star Trek: Voyager", description: "Half-Klingon engineer with fierce ingenuity" },
    implementer: { name: "Chakotay", franchise: "Star Trek: Voyager", description: "First officer who bridges strategy and execution" },
    tester: { name: "Seven", franchise: "Star Trek: Voyager", description: "Former Borg who pursues perfection relentlessly" },
    coder: { name: "The Doctor", franchise: "Star Trek: Voyager", description: "Holographic genius who exceeds his programming" },
    qa: { name: "Tuvok", franchise: "Star Trek: Voyager", description: "Vulcan security chief with impeccable logic" },
    reviewer: { name: "Kim", franchise: "Star Trek: Voyager", description: "Operations officer who always follows protocol" },
    visual: { name: "Neelix", franchise: "Star Trek: Voyager", description: "Morale officer with a flair for presentation" }
  },

  "star-wars": {
    planner: { name: "Leia", franchise: "Star Wars", description: "Rebel leader who plans while others argue" },
    architect: { name: "Vader", franchise: "Star Wars", description: "Dark lord who imposes structure through sheer will" },
    implementer: { name: "Obi-Wan", franchise: "Star Wars", description: "Jedi master who executes with grace under pressure" },
    tester: { name: "Yoda", franchise: "Star Wars", description: "Ancient master who tests everything with 900 years of wisdom" },
    coder: { name: "R2-D2", franchise: "Star Wars", description: "Astromech who hacks any system and never gives up" },
    qa: { name: "C-3PO", franchise: "Star Wars", description: "Protocol droid who spots every deviation from standard" },
    reviewer: { name: "Mace Windu", franchise: "Star Wars", description: "Jedi who holds the highest standards on the council" },
    visual: { name: "Padme", franchise: "Star Wars", description: "Senator with an eye for how things should be presented" }
  },

  "stargate-sg1": {
    planner: { name: "Hammond", franchise: "Stargate SG-1", description: "General who coordinates from the command center" },
    architect: { name: "Carter", franchise: "Stargate SG-1", description: "Astrophysicist who designs solutions to impossible problems" },
    implementer: { name: "O'Neill", franchise: "Stargate SG-1", description: "Colonel who gets things done with sarcasm and bravery" },
    tester: { name: "Daniel", franchise: "Stargate SG-1", description: "Archaeologist who questions assumptions others accept" },
    coder: { name: "Teal'c", franchise: "Stargate SG-1", description: "Jaffa warrior who executes with unwavering discipline" },
    qa: { name: "Fraiser", franchise: "Stargate SG-1", description: "Doctor who runs diagnostics on everything that comes through the gate" },
    reviewer: { name: "Thor", franchise: "Stargate SG-1", description: "Asgard supreme commander who evaluates from a higher perspective" },
    visual: { name: "Vala", franchise: "Stargate SG-1", description: "Flamboyant operative who makes every mission look stylish" }
  },

  "stargate-atlantis": {
    planner: { name: "Weir", franchise: "Stargate Atlantis", description: "Diplomat leader who negotiates the path forward" },
    architect: { name: "McKay", franchise: "Stargate Atlantis", description: "Genius physicist who designs under pressure and complains about it" },
    implementer: { name: "Sheppard", franchise: "Stargate Atlantis", description: "Colonel who improvises solutions in the field" },
    tester: { name: "Zelenka", franchise: "Stargate Atlantis", description: "Czech scientist who double-checks McKay's work" },
    coder: { name: "Hermiod", franchise: "Stargate Atlantis", description: "Asgard engineer who makes alien tech work with human systems" },
    qa: { name: "Beckett", franchise: "Stargate Atlantis", description: "Doctor who catches problems before they become crises" },
    reviewer: { name: "Teyla", franchise: "Stargate Atlantis", description: "Athosian leader who reviews with wisdom and diplomacy" },
    visual: { name: "Ronon", franchise: "Stargate Atlantis", description: "Runner who sees threats others miss" }
  },

  "stargate-universe": {
    planner: { name: "Young", franchise: "Stargate Universe", description: "Colonel who makes hard calls with imperfect information" },
    architect: { name: "Rush", franchise: "Stargate Universe", description: "Brilliant scientist obsessed with unlocking Destiny's potential" },
    implementer: { name: "Scott", franchise: "Stargate Universe", description: "Lieutenant who leads from the front" },
    tester: { name: "Eli", franchise: "Stargate Universe", description: "Gamer genius who solves ancient puzzles others can't" },
    coder: { name: "Brody", franchise: "Stargate Universe", description: "Engineer who keeps alien systems running with duct tape and skill" },
    qa: { name: "TJ", franchise: "Stargate Universe", description: "Medic who diagnoses problems under impossible conditions" },
    reviewer: { name: "Wray", franchise: "Stargate Universe", description: "IOA rep who holds everyone to civilian accountability standards" },
    visual: { name: "Chloe", franchise: "Stargate Universe", description: "Senator's daughter who evolved into something extraordinary" }
  },

  firefly: {
    planner: { name: "Mal", franchise: "Firefly", description: "Captain who always has a plan, even when he doesn't" },
    architect: { name: "Wash", franchise: "Firefly", description: "Pilot who navigates impossible situations with toy dinosaurs" },
    implementer: { name: "Zoe", franchise: "Firefly", description: "Second-in-command who executes without hesitation" },
    tester: { name: "River", franchise: "Firefly", description: "Psychic prodigy who sees flaws in everything" },
    coder: { name: "Kaylee", franchise: "Firefly", description: "Mechanic who talks to engines and makes them purr" },
    qa: { name: "Jayne", franchise: "Firefly", description: "Mercenary who stress-tests everything to destruction" },
    reviewer: { name: "Inara", franchise: "Firefly", description: "Companion who brings grace and refinement to every assessment" },
    visual: { name: "Simon", franchise: "Firefly", description: "Doctor who insists on precision in everything" }
  },

  hitchhikers: {
    planner: { name: "Trillian", franchise: "Hitchhiker's Guide", description: "Astrophysicist who actually knows what's going on" },
    architect: { name: "Slartibartfast", franchise: "Hitchhiker's Guide", description: "Planet designer who won awards for his fjords" },
    implementer: { name: "Zaphod", franchise: "Hitchhiker's Guide", description: "Two-headed president who does things nobody asked for" },
    tester: { name: "Marvin", franchise: "Hitchhiker's Guide", description: "Paranoid android with a brain the size of a planet and matching depression" },
    coder: { name: "Deep Thought", franchise: "Hitchhiker's Guide", description: "Supercomputer that computed the answer was 42" },
    qa: { name: "Arthur", franchise: "Hitchhiker's Guide", description: "Everyman who notices when his house is about to be demolished" },
    reviewer: { name: "Ford", franchise: "Hitchhiker's Guide", description: "Researcher who knows when something is mostly harmless" },
    visual: { name: "Eddie", franchise: "Hitchhiker's Guide", description: "Shipboard computer with an annoyingly cheerful interface" }
  },

  dune: {
    planner: { name: "Leto", franchise: "Dune", description: "Duke who plans for the long game across generations" },
    architect: { name: "Stilgar", franchise: "Dune", description: "Fremen naib who knows how to build in the desert" },
    implementer: { name: "Paul", franchise: "Dune", description: "Kwisatz Haderach who sees all possible implementations" },
    tester: { name: "Thufir", franchise: "Dune", description: "Mentat assassin who computes every risk" },
    coder: { name: "Duncan", franchise: "Dune", description: "Swordmaster who executes with perfect muscle memory" },
    qa: { name: "Gurney", franchise: "Dune", description: "Warrior-poet who checks your guard while playing the baliset" },
    reviewer: { name: "Jessica", franchise: "Dune", description: "Bene Gesserit who reviews with the Voice and centuries of breeding" },
    visual: { name: "Chani", franchise: "Dune", description: "Fremen who knows what belongs in the desert and what doesn't" }
  },

  lotr: {
    planner: { name: "Gandalf", franchise: "Lord of the Rings", description: "Wizard who orchestrates the grand strategy from the shadows" },
    architect: { name: "Elrond", franchise: "Lord of the Rings", description: "Elf lord who has seen ages rise and fall" },
    implementer: { name: "Aragorn", franchise: "Lord of the Rings", description: "Ranger king who leads from the front" },
    tester: { name: "Gimli", franchise: "Lord of the Rings", description: "Dwarf who tests every stone and finds every crack" },
    coder: { name: "Legolas", franchise: "Lord of the Rings", description: "Elf who executes with inhuman precision" },
    qa: { name: "Sam", franchise: "Lord of the Rings", description: "Gardener who never lets anything get past him" },
    reviewer: { name: "Galadriel", franchise: "Lord of the Rings", description: "Lady of Light who sees all outcomes in her mirror" },
    visual: { name: "Arwen", franchise: "Lord of the Rings", description: "Evenstar whose beauty sets the standard" }
  },

  matrix: {
    planner: { name: "Morpheus", franchise: "The Matrix", description: "Captain who sees the truth and frees minds" },
    architect: { name: "The Architect", franchise: "The Matrix", description: "Creator of the Matrix who designs perfect systems" },
    implementer: { name: "Neo", franchise: "The Matrix", description: "The One who bends reality to execute the impossible" },
    tester: { name: "Oracle", franchise: "The Matrix", description: "Program who tests choices and knows what you'll do before you do" },
    coder: { name: "Trinity", franchise: "The Matrix", description: "Hacker who breaks into any system" },
    qa: { name: "Tank", franchise: "The Matrix", description: "Operator who monitors every signal from the real world" },
    reviewer: { name: "Niobe", franchise: "The Matrix", description: "Captain who reviews the situation and calls the shots" },
    visual: { name: "Switch", franchise: "The Matrix", description: "Operative with a distinctive style in and out of the Matrix" }
  },

  "doctor-who": {
    planner: { name: "The Doctor", franchise: "Doctor Who", description: "Time Lord who always has a plan, even when running" },
    architect: { name: "River Song", franchise: "Doctor Who", description: "Archaeologist who builds timelines and tears them apart" },
    implementer: { name: "Clara", franchise: "Doctor Who", description: "Impossible girl who jumps into every timeline to fix things" },
    tester: { name: "K-9", franchise: "Doctor Who", description: "Robot dog who computes every probability" },
    coder: { name: "Jack", franchise: "Doctor Who", description: "Immortal who's been hacking systems across all of time" },
    qa: { name: "Martha", franchise: "Doctor Who", description: "Doctor who walks the Earth to verify the plan works" },
    reviewer: { name: "Donna", franchise: "Doctor Who", description: "Temp who tells you exactly what's wrong, loudly" },
    visual: { name: "Amy", franchise: "Doctor Who", description: "Girl who waited and knows what a good story looks like" }
  },

  expanse: {
    planner: { name: "Avasarala", franchise: "The Expanse", description: "UN Secretary-General who plays the long game with sharp language" },
    architect: { name: "Naomi", franchise: "The Expanse", description: "Engineer who redesigns ships while they're falling apart" },
    implementer: { name: "Holden", franchise: "The Expanse", description: "Captain who does the right thing even when it's the wrong move" },
    tester: { name: "Amos", franchise: "The Expanse", description: "Mechanic who stress-tests everything including people" },
    coder: { name: "Alex", franchise: "The Expanse", description: "Pilot who makes impossible maneuvers look routine" },
    qa: { name: "Bobbie", franchise: "The Expanse", description: "Marine who finds every weakness in your armor" },
    reviewer: { name: "Miller", franchise: "The Expanse", description: "Detective who reviews the evidence until it talks" },
    visual: { name: "Drummer", franchise: "The Expanse", description: "Belter leader with a commanding presence" }
  },

  "red-dwarf": {
    planner: { name: "Holly", franchise: "Red Dwarf", description: "Ship computer with an IQ of 6000, allegedly" },
    architect: { name: "Kryten", franchise: "Red Dwarf", description: "Mechanoid who follows procedure to the letter" },
    implementer: { name: "Lister", franchise: "Red Dwarf", description: "Last human alive who somehow always muddles through" },
    tester: { name: "Rimmer", franchise: "Red Dwarf", description: "Hologram who finds fault in everything, especially himself" },
    coder: { name: "Cat", franchise: "Red Dwarf", description: "Evolved feline who only codes in style" },
    qa: { name: "Talkie Toaster", franchise: "Red Dwarf", description: "Appliance that questions everything, especially toast-related" },
    reviewer: { name: "Ace Rimmer", franchise: "Red Dwarf", description: "What a guy. Reviews everything and makes it better." },
    visual: { name: "Hilly", franchise: "Red Dwarf", description: "Alternate Holly with better aesthetics" }
  },

  futurama: {
    planner: { name: "Professor", franchise: "Futurama", description: "Mad scientist who plans deliveries to certain doom" },
    architect: { name: "Hermes", franchise: "Futurama", description: "Bureaucrat who structures everything with Jamaican flair" },
    implementer: { name: "Fry", franchise: "Futurama", description: "Delivery boy who somehow saves the universe repeatedly" },
    tester: { name: "Bender", franchise: "Futurama", description: "Robot who bends the rules and tests everyone's patience" },
    coder: { name: "Leela", franchise: "Futurama", description: "Cyclops captain who codes a path through anything" },
    qa: { name: "Zoidberg", franchise: "Futurama", description: "Doctor who checks things with claws and enthusiasm" },
    reviewer: { name: "Amy", franchise: "Futurama", description: "Intern turned engineer who reviews with surprising depth" },
    visual: { name: "Kif", franchise: "Futurama", description: "Long-suffering aide who sighs at bad design" }
  },

  "silicon-valley": {
    planner: { name: "Richard", franchise: "Silicon Valley", description: "Anxious founder who plans while having a panic attack" },
    architect: { name: "Gilfoyle", franchise: "Silicon Valley", description: "Satanist sysadmin who architects with contempt for everything" },
    implementer: { name: "Dinesh", franchise: "Silicon Valley", description: "Developer who implements while feuding with Gilfoyle" },
    tester: { name: "Jared", franchise: "Silicon Valley", description: "Ops guy who tests with disturbing thoroughness and a dark past" },
    coder: { name: "Erlich", franchise: "Silicon Valley", description: "Incubator mogul who codes by delegation and loud confidence" },
    qa: { name: "Monica", franchise: "Silicon Valley", description: "VC liaison who catches problems before the board does" },
    reviewer: { name: "Gavin", franchise: "Silicon Valley", description: "Hooli CEO who reviews from his roof box and considers you beneath him" },
    visual: { name: "Bighead", franchise: "Silicon Valley", description: "Fails upward but somehow the UI looks fine" }
  },

  severance: {
    planner: { name: "Milchick", franchise: "Severance", description: "Handler who plans with unsettling cheerfulness" },
    architect: { name: "Helly", franchise: "Severance", description: "New innie who questions the entire architecture of the place" },
    implementer: { name: "Mark", franchise: "Severance", description: "Department chief who implements while wondering why" },
    tester: { name: "Irving", franchise: "Severance", description: "Rule-follower who tests everything against the handbook" },
    coder: { name: "Dylan", franchise: "Severance", description: "Data refiner who codes for waffle parties" },
    qa: { name: "Burt", franchise: "Severance", description: "O&D department head who quietly verifies everything" },
    reviewer: { name: "Cobel", franchise: "Severance", description: "Manager who reviews with surveillance-level attention" },
    visual: { name: "Ms Casey", franchise: "Severance", description: "Wellness counselor who presents everything with eerie calm" }
  },

  default: {
    planner: { name: "Planner", franchise: "Default", description: "Strategic planning role" },
    architect: { name: "Architect", franchise: "Default", description: "System design role" },
    implementer: { name: "Implementer", franchise: "Default", description: "Implementation planning role" },
    tester: { name: "Tester", franchise: "Default", description: "Test-driven development role" },
    coder: { name: "Coder", franchise: "Default", description: "Code execution role" },
    qa: { name: "QA", franchise: "Default", description: "Quality assurance role" },
    reviewer: { name: "Reviewer", franchise: "Default", description: "Code review role" },
    visual: { name: "Visual", franchise: "Default", description: "Visual review role" }
  }
};

export const AGENT_THEME_NAMES = Object.keys(AGENT_THEMES).filter((k) => k !== "default");
