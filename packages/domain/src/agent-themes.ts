/**
 * Agent character themes — pools of characters from sci-fi, TV, and mythology.
 * Characters are randomly assigned to roles at project creation time.
 * Each theme is a flat list — no role-to-character mapping.
 */

export interface AgentCharacter {
  name: string;
  franchise: string;
  description: string;
}

export const AGENT_THEMES: Record<string, AgentCharacter[]> = {
  mythology: [
    { name: "Athena", franchise: "Greek Mythology", description: "Goddess of wisdom and strategic warfare" },
    { name: "Hephaestus", franchise: "Greek Mythology", description: "God of the forge and master craftsman" },
    { name: "Prometheus", franchise: "Greek Mythology", description: "Titan who brought fire and foresight to humanity" },
    { name: "Nemesis", franchise: "Greek Mythology", description: "Goddess of retribution who ensures nothing goes unchecked" },
    { name: "Pygmalion", franchise: "Greek Mythology", description: "Sculptor who brought his creation to life" },
    { name: "Argus", franchise: "Greek Mythology", description: "Hundred-eyed giant who sees everything" },
    { name: "Momus", franchise: "Greek Mythology", description: "God of satire and sharp-eyed criticism" },
    { name: "Apollo", franchise: "Greek Mythology", description: "God of light, art, and aesthetic perfection" },
    { name: "Hermes", franchise: "Greek Mythology", description: "Messenger god, fastest thinker on Olympus" },
    { name: "Artemis", franchise: "Greek Mythology", description: "Huntress who never misses her target" },
    { name: "Daedalus", franchise: "Greek Mythology", description: "Inventor of the labyrinth and master engineer" },
    { name: "Cassandra", franchise: "Greek Mythology", description: "Prophet who always sees the truth, rarely believed" },
    { name: "Hera", franchise: "Greek Mythology", description: "Queen of the gods who keeps everyone in line" },
    { name: "Persephone", franchise: "Greek Mythology", description: "Queen of the underworld who bridges two worlds" },
  ],

  norse: [
    { name: "Odin", franchise: "Norse Mythology", description: "Allfather who sacrificed an eye for wisdom" },
    { name: "Thor", franchise: "Norse Mythology", description: "God of thunder who gets things done with force" },
    { name: "Loki", franchise: "Norse Mythology", description: "Trickster who finds creative solutions to impossible problems" },
    { name: "Freya", franchise: "Norse Mythology", description: "Goddess of beauty, love, and war" },
    { name: "Heimdall", franchise: "Norse Mythology", description: "Guardian who watches all nine realms" },
    { name: "Tyr", franchise: "Norse Mythology", description: "God of law who sacrificed his hand for order" },
    { name: "Mimir", franchise: "Norse Mythology", description: "Wisest of the Aesir, keeper of knowledge" },
    { name: "Wayland", franchise: "Norse Mythology", description: "Legendary smith who forges the impossible" },
    { name: "Forseti", franchise: "Norse Mythology", description: "God of justice and truth" },
    { name: "Bragi", franchise: "Norse Mythology", description: "God of poetry and eloquent speech" },
    { name: "Idun", franchise: "Norse Mythology", description: "Keeper of the golden apples of immortality" },
    { name: "Skadi", franchise: "Norse Mythology", description: "Giant huntress of the frozen mountains" },
  ],

  "star-trek-tos": [
    { name: "Kirk", franchise: "Star Trek: TOS", description: "Bold captain who leads from the front" },
    { name: "Spock", franchise: "Star Trek: TOS", description: "Half-Vulcan driven by pure logic" },
    { name: "McCoy", franchise: "Star Trek: TOS", description: "Doctor who questions everything with passion" },
    { name: "Scotty", franchise: "Star Trek: TOS", description: "Miracle worker who keeps the ship together" },
    { name: "Uhura", franchise: "Star Trek: TOS", description: "Communications expert who bridges all systems" },
    { name: "Sulu", franchise: "Star Trek: TOS", description: "Steady helmsman who never misses a course correction" },
    { name: "Chekov", franchise: "Star Trek: TOS", description: "Sharp navigator who double-checks every calculation" },
    { name: "Chapel", franchise: "Star Trek: TOS", description: "Nurse with an eye for what needs attention" },
    { name: "Rand", franchise: "Star Trek: TOS", description: "Yeoman who keeps the captain organized" },
    { name: "T'Pau", franchise: "Star Trek: TOS", description: "Vulcan elder who commands absolute respect" },
  ],

  "star-trek-tng": [
    { name: "Picard", franchise: "Star Trek: TNG", description: "Diplomat captain who leads with principle and eloquence" },
    { name: "Riker", franchise: "Star Trek: TNG", description: "First officer who turns plans into action" },
    { name: "Data", franchise: "Star Trek: TNG", description: "Android who tests every assumption with precision" },
    { name: "LaForge", franchise: "Star Trek: TNG", description: "Chief engineer who sees what others can't" },
    { name: "Worf", franchise: "Star Trek: TNG", description: "Security chief who tolerates zero defects" },
    { name: "Troi", franchise: "Star Trek: TNG", description: "Empath who senses what's really going on" },
    { name: "Crusher", franchise: "Star Trek: TNG", description: "Doctor who diagnoses problems others miss" },
    { name: "Wesley", franchise: "Star Trek: TNG", description: "Prodigy who writes solutions nobody expected" },
    { name: "Guinan", franchise: "Star Trek: TNG", description: "Bartender sage with timeless perspective" },
    { name: "Q", franchise: "Star Trek: TNG", description: "Omnipotent trickster who tests everyone's limits" },
    { name: "Ro", franchise: "Star Trek: TNG", description: "Bajoran officer who challenges authority" },
    { name: "Barclay", franchise: "Star Trek: TNG", description: "Anxious engineer who solves problems in the holodeck" },
  ],

  "star-trek-ds9": [
    { name: "Sisko", franchise: "Star Trek: DS9", description: "Commander who builds civilisation at the frontier" },
    { name: "Kira", franchise: "Star Trek: DS9", description: "Former resistance fighter who executes with conviction" },
    { name: "Odo", franchise: "Star Trek: DS9", description: "Shapeshifter constable who finds every flaw" },
    { name: "Dax", franchise: "Star Trek: DS9", description: "Joined Trill with lifetimes of experience" },
    { name: "O'Brien", franchise: "Star Trek: DS9", description: "Chief of operations who fixes everything" },
    { name: "Bashir", franchise: "Star Trek: DS9", description: "Enhanced doctor who catches what others miss" },
    { name: "Garak", franchise: "Star Trek: DS9", description: "Tailor-spy whose observations are lethally precise" },
    { name: "Quark", franchise: "Star Trek: DS9", description: "Ferengi who knows how to present a deal" },
    { name: "Weyoun", franchise: "Star Trek: DS9", description: "Vorta diplomat who negotiates with a smile" },
    { name: "Dukat", franchise: "Star Trek: DS9", description: "Cardassian who believes he's always right" },
    { name: "Nog", franchise: "Star Trek: DS9", description: "Ferengi who earned his commission the hard way" },
    { name: "Rom", franchise: "Star Trek: DS9", description: "Underestimated engineer who quietly saves the day" },
  ],

  "star-trek-voyager": [
    { name: "Janeway", franchise: "Star Trek: Voyager", description: "Captain who finds a way home against all odds" },
    { name: "Chakotay", franchise: "Star Trek: Voyager", description: "First officer who bridges strategy and spirit" },
    { name: "Seven", franchise: "Star Trek: Voyager", description: "Former Borg who pursues perfection relentlessly" },
    { name: "B'Elanna", franchise: "Star Trek: Voyager", description: "Half-Klingon engineer with fierce ingenuity" },
    { name: "The Doctor", franchise: "Star Trek: Voyager", description: "Holographic genius who exceeds his programming" },
    { name: "Tuvok", franchise: "Star Trek: Voyager", description: "Vulcan security chief with impeccable logic" },
    { name: "Kim", franchise: "Star Trek: Voyager", description: "Operations officer who always follows protocol" },
    { name: "Neelix", franchise: "Star Trek: Voyager", description: "Morale officer with flair for presentation" },
    { name: "Kes", franchise: "Star Trek: Voyager", description: "Ocampa with rapidly evolving abilities" },
    { name: "Paris", franchise: "Star Trek: Voyager", description: "Pilot who flies by instinct and charm" },
  ],

  "star-wars": [
    { name: "Leia", franchise: "Star Wars", description: "Rebel leader who plans while others argue" },
    { name: "Obi-Wan", franchise: "Star Wars", description: "Jedi master who executes with grace under pressure" },
    { name: "Yoda", franchise: "Star Wars", description: "Ancient master with 900 years of wisdom" },
    { name: "R2-D2", franchise: "Star Wars", description: "Astromech who hacks any system and never gives up" },
    { name: "C-3PO", franchise: "Star Wars", description: "Protocol droid who spots every deviation from standard" },
    { name: "Ahsoka", franchise: "Star Wars", description: "Togruta who walks her own path between light and dark" },
    { name: "Vader", franchise: "Star Wars", description: "Dark lord who imposes order through sheer will" },
    { name: "Han", franchise: "Star Wars", description: "Smuggler who improvises under fire" },
    { name: "Mace Windu", franchise: "Star Wars", description: "Jedi who holds the highest standards on the council" },
    { name: "Padme", franchise: "Star Wars", description: "Senator who fights for democracy with eloquence" },
    { name: "Din Djarin", franchise: "Star Wars", description: "Mandalorian who follows the Way, no exceptions" },
    { name: "Andor", franchise: "Star Wars", description: "Spy who does the dirty work so others don't have to" },
    { name: "K-2SO", franchise: "Star Wars", description: "Reprogrammed Imperial droid with no filter" },
    { name: "Chirrut", franchise: "Star Wars", description: "Blind warrior who trusts the Force with everything" },
  ],

  "stargate-sg1": [
    { name: "O'Neill", franchise: "Stargate SG-1", description: "Colonel who gets things done with sarcasm and bravery" },
    { name: "Carter", franchise: "Stargate SG-1", description: "Astrophysicist who designs solutions to impossible problems" },
    { name: "Daniel", franchise: "Stargate SG-1", description: "Archaeologist who questions assumptions others accept" },
    { name: "Teal'c", franchise: "Stargate SG-1", description: "Jaffa warrior who executes with unwavering discipline" },
    { name: "Hammond", franchise: "Stargate SG-1", description: "General who coordinates from the command center" },
    { name: "Fraiser", franchise: "Stargate SG-1", description: "Doctor who runs diagnostics on everything" },
    { name: "Thor", franchise: "Stargate SG-1", description: "Asgard commander who evaluates from a higher perspective" },
    { name: "Vala", franchise: "Stargate SG-1", description: "Flamboyant operative who makes every mission stylish" },
    { name: "Mitchell", franchise: "Stargate SG-1", description: "Pilot who earned his place through sheer determination" },
    { name: "Ba'al", franchise: "Stargate SG-1", description: "System lord who always has a backup plan" },
    { name: "Jacob", franchise: "Stargate SG-1", description: "Tok'ra general who bridges two civilisations" },
    { name: "Bra'tac", franchise: "Stargate SG-1", description: "Master warrior who trained generations of Jaffa" },
  ],

  "stargate-atlantis": [
    { name: "Sheppard", franchise: "Stargate Atlantis", description: "Colonel who improvises solutions in the field" },
    { name: "McKay", franchise: "Stargate Atlantis", description: "Genius physicist who solves crises while complaining about them" },
    { name: "Weir", franchise: "Stargate Atlantis", description: "Diplomat leader who negotiates the path forward" },
    { name: "Teyla", franchise: "Stargate Atlantis", description: "Athosian leader who bridges cultures with wisdom" },
    { name: "Ronon", franchise: "Stargate Atlantis", description: "Runner who sees threats others miss" },
    { name: "Beckett", franchise: "Stargate Atlantis", description: "Doctor who catches problems before they become crises" },
    { name: "Zelenka", franchise: "Stargate Atlantis", description: "Czech scientist who double-checks everyone's work" },
    { name: "Woolsey", franchise: "Stargate Atlantis", description: "Bureaucrat who grows into a compassionate leader" },
    { name: "Lorne", franchise: "Stargate Atlantis", description: "Major who keeps operations running smoothly" },
    { name: "Todd", franchise: "Stargate Atlantis", description: "Wraith ally with his own agenda" },
  ],

  "stargate-universe": [
    { name: "Young", franchise: "Stargate Universe", description: "Colonel who makes hard calls with imperfect information" },
    { name: "Rush", franchise: "Stargate Universe", description: "Brilliant scientist obsessed with unlocking Destiny" },
    { name: "Eli", franchise: "Stargate Universe", description: "Gamer genius who solves ancient puzzles others can't" },
    { name: "Scott", franchise: "Stargate Universe", description: "Lieutenant who leads from the front" },
    { name: "Chloe", franchise: "Stargate Universe", description: "Senator's daughter who evolved into something extraordinary" },
    { name: "TJ", franchise: "Stargate Universe", description: "Medic who diagnoses under impossible conditions" },
    { name: "Greer", franchise: "Stargate Universe", description: "Sergeant who protects the crew with fierce loyalty" },
    { name: "Wray", franchise: "Stargate Universe", description: "IOA rep who holds everyone to civilian standards" },
    { name: "Brody", franchise: "Stargate Universe", description: "Engineer who keeps alien systems running" },
    { name: "Volker", franchise: "Stargate Universe", description: "Astrophysicist who tracks the stars" },
  ],

  firefly: [
    { name: "Mal", franchise: "Firefly", description: "Captain who always has a plan, even when he doesn't" },
    { name: "Zoe", franchise: "Firefly", description: "Second-in-command who executes without hesitation" },
    { name: "Wash", franchise: "Firefly", description: "Pilot who navigates the impossible with toy dinosaurs" },
    { name: "Kaylee", franchise: "Firefly", description: "Mechanic who talks to engines and makes them purr" },
    { name: "Jayne", franchise: "Firefly", description: "Mercenary who stress-tests everything to destruction" },
    { name: "River", franchise: "Firefly", description: "Psychic prodigy who sees flaws in everything" },
    { name: "Simon", franchise: "Firefly", description: "Doctor who insists on precision in everything" },
    { name: "Inara", franchise: "Firefly", description: "Companion who brings grace to every assessment" },
    { name: "Book", franchise: "Firefly", description: "Shepherd with a mysterious past and sharp insight" },
    { name: "Badger", franchise: "Firefly", description: "Dealer who always knows the angle" },
  ],

  hitchhikers: [
    { name: "Arthur", franchise: "Hitchhiker's Guide", description: "Everyman who notices when reality doesn't add up" },
    { name: "Ford", franchise: "Hitchhiker's Guide", description: "Researcher who knows when something is mostly harmless" },
    { name: "Trillian", franchise: "Hitchhiker's Guide", description: "Astrophysicist who actually knows what's going on" },
    { name: "Zaphod", franchise: "Hitchhiker's Guide", description: "Two-headed president who does things nobody asked for" },
    { name: "Marvin", franchise: "Hitchhiker's Guide", description: "Paranoid android with a brain the size of a planet" },
    { name: "Slartibartfast", franchise: "Hitchhiker's Guide", description: "Planet designer who won awards for his fjords" },
    { name: "Deep Thought", franchise: "Hitchhiker's Guide", description: "Supercomputer that computed the answer was 42" },
    { name: "Eddie", franchise: "Hitchhiker's Guide", description: "Shipboard computer with annoyingly cheerful interface" },
    { name: "Prostetnic Jeltz", franchise: "Hitchhiker's Guide", description: "Vogon captain who reads terrible poetry before demolition" },
    { name: "Agrajag", franchise: "Hitchhiker's Guide", description: "Entity repeatedly killed by Arthur across all timelines" },
  ],

  dune: [
    { name: "Paul", franchise: "Dune", description: "Kwisatz Haderach who sees all possible paths" },
    { name: "Leto", franchise: "Dune", description: "Duke who plans for the long game across generations" },
    { name: "Jessica", franchise: "Dune", description: "Bene Gesserit who reviews with the Voice" },
    { name: "Duncan", franchise: "Dune", description: "Swordmaster who executes with perfect muscle memory" },
    { name: "Stilgar", franchise: "Dune", description: "Fremen naib who knows how to build in the desert" },
    { name: "Chani", franchise: "Dune", description: "Fremen who knows what belongs and what doesn't" },
    { name: "Thufir", franchise: "Dune", description: "Mentat who computes every risk" },
    { name: "Gurney", franchise: "Dune", description: "Warrior-poet who checks your guard while playing the baliset" },
    { name: "Alia", franchise: "Dune", description: "Pre-born with ancestral memory and terrifying insight" },
    { name: "Irulan", franchise: "Dune", description: "Princess historian who documents everything" },
    { name: "Liet-Kynes", franchise: "Dune", description: "Planetologist who dreams of terraforming" },
    { name: "Feyd-Rautha", franchise: "Dune", description: "Gladiator heir who fights with calculated cruelty" },
  ],

  lotr: [
    { name: "Gandalf", franchise: "Lord of the Rings", description: "Wizard who orchestrates the grand strategy" },
    { name: "Aragorn", franchise: "Lord of the Rings", description: "Ranger king who leads from the front" },
    { name: "Legolas", franchise: "Lord of the Rings", description: "Elf who executes with inhuman precision" },
    { name: "Gimli", franchise: "Lord of the Rings", description: "Dwarf who tests every stone and finds every crack" },
    { name: "Sam", franchise: "Lord of the Rings", description: "Gardener who never lets anything get past him" },
    { name: "Galadriel", franchise: "Lord of the Rings", description: "Lady of Light who sees all outcomes" },
    { name: "Elrond", franchise: "Lord of the Rings", description: "Elf lord who has seen ages rise and fall" },
    { name: "Arwen", franchise: "Lord of the Rings", description: "Evenstar whose beauty sets the standard" },
    { name: "Eowyn", franchise: "Lord of the Rings", description: "Shieldmaiden who defies expectations" },
    { name: "Faramir", franchise: "Lord of the Rings", description: "Captain who leads with wisdom over glory" },
    { name: "Theoden", franchise: "Lord of the Rings", description: "King who rides to battle when hope seems lost" },
    { name: "Treebeard", franchise: "Lord of the Rings", description: "Ent who deliberates thoroughly before acting" },
  ],

  matrix: [
    { name: "Neo", franchise: "The Matrix", description: "The One who bends reality to execute the impossible" },
    { name: "Morpheus", franchise: "The Matrix", description: "Captain who sees the truth and frees minds" },
    { name: "Trinity", franchise: "The Matrix", description: "Hacker who breaks into any system" },
    { name: "The Oracle", franchise: "The Matrix", description: "Program who tests choices before you make them" },
    { name: "The Architect", franchise: "The Matrix", description: "Creator who designs perfect systems" },
    { name: "Tank", franchise: "The Matrix", description: "Operator who monitors every signal" },
    { name: "Niobe", franchise: "The Matrix", description: "Captain who reviews the situation and calls shots" },
    { name: "Switch", franchise: "The Matrix", description: "Operative with a distinctive style" },
    { name: "The Merovingian", franchise: "The Matrix", description: "Information broker who trades in causality" },
    { name: "Agent Smith", franchise: "The Matrix", description: "Program who relentlessly pursues compliance" },
    { name: "The Keymaker", franchise: "The Matrix", description: "Program who opens doors nobody else can" },
  ],

  "doctor-who": [
    { name: "The Doctor", franchise: "Doctor Who", description: "Time Lord who always has a plan, even when running" },
    { name: "River Song", franchise: "Doctor Who", description: "Archaeologist who builds and tears apart timelines" },
    { name: "Clara", franchise: "Doctor Who", description: "Impossible girl who fixes things across every timeline" },
    { name: "K-9", franchise: "Doctor Who", description: "Robot dog who computes every probability" },
    { name: "Jack", franchise: "Doctor Who", description: "Immortal who's been hacking across all of time" },
    { name: "Martha", franchise: "Doctor Who", description: "Doctor who walked the Earth to verify the plan works" },
    { name: "Donna", franchise: "Doctor Who", description: "Temp who tells you exactly what's wrong, loudly" },
    { name: "Amy", franchise: "Doctor Who", description: "Girl who waited and knows what a good story looks like" },
    { name: "Rory", franchise: "Doctor Who", description: "Centurion who guards his post for 2000 years" },
    { name: "Sarah Jane", franchise: "Doctor Who", description: "Journalist who investigates the impossible" },
    { name: "Davros", franchise: "Doctor Who", description: "Creator of the Daleks, twisted genius" },
    { name: "Missy", franchise: "Doctor Who", description: "Time Lady who causes chaos with flair" },
  ],

  expanse: [
    { name: "Holden", franchise: "The Expanse", description: "Captain who does the right thing even when it's wrong" },
    { name: "Naomi", franchise: "The Expanse", description: "Engineer who redesigns ships while they fall apart" },
    { name: "Amos", franchise: "The Expanse", description: "Mechanic who stress-tests everything including people" },
    { name: "Alex", franchise: "The Expanse", description: "Pilot who makes impossible maneuvers look routine" },
    { name: "Avasarala", franchise: "The Expanse", description: "Secretary-General who plays the long game with sharp language" },
    { name: "Bobbie", franchise: "The Expanse", description: "Marine who finds every weakness in your armor" },
    { name: "Miller", franchise: "The Expanse", description: "Detective who reviews evidence until it talks" },
    { name: "Drummer", franchise: "The Expanse", description: "Belter leader with a commanding presence" },
    { name: "Ashford", franchise: "The Expanse", description: "Pirate turned captain who leads by hard-won respect" },
    { name: "Prax", franchise: "The Expanse", description: "Botanist who finds life where nobody expects it" },
  ],

  "red-dwarf": [
    { name: "Lister", franchise: "Red Dwarf", description: "Last human alive who somehow always muddles through" },
    { name: "Rimmer", franchise: "Red Dwarf", description: "Hologram who finds fault in everything, especially himself" },
    { name: "Cat", franchise: "Red Dwarf", description: "Evolved feline who only operates in style" },
    { name: "Kryten", franchise: "Red Dwarf", description: "Mechanoid who follows procedure to the letter" },
    { name: "Holly", franchise: "Red Dwarf", description: "Ship computer with an IQ of 6000, allegedly" },
    { name: "Ace Rimmer", franchise: "Red Dwarf", description: "What a guy. Makes everything better." },
    { name: "Talkie Toaster", franchise: "Red Dwarf", description: "Questions everything, especially toast preferences" },
    { name: "Legion", franchise: "Red Dwarf", description: "Gestalt entity made of everyone's best qualities" },
    { name: "Hilly", franchise: "Red Dwarf", description: "Alternate Holly with different aesthetic sensibilities" },
    { name: "Able", franchise: "Red Dwarf", description: "Simulant who doesn't hold back" },
  ],

  futurama: [
    { name: "Fry", franchise: "Futurama", description: "Delivery boy who somehow saves the universe repeatedly" },
    { name: "Leela", franchise: "Futurama", description: "Cyclops captain who navigates through anything" },
    { name: "Bender", franchise: "Futurama", description: "Robot who bends rules and tests everyone's patience" },
    { name: "Professor", franchise: "Futurama", description: "Mad scientist who plans deliveries to certain doom" },
    { name: "Hermes", franchise: "Futurama", description: "Bureaucrat who structures everything with Jamaican flair" },
    { name: "Amy", franchise: "Futurama", description: "Intern turned engineer who reviews with surprising depth" },
    { name: "Zoidberg", franchise: "Futurama", description: "Doctor who checks things with claws and enthusiasm" },
    { name: "Kif", franchise: "Futurama", description: "Long-suffering aide who sighs at bad design" },
    { name: "Zapp", franchise: "Futurama", description: "Captain who leads with confidence untouched by competence" },
    { name: "Nibbler", franchise: "Futurama", description: "Ancient being disguised as a cute pet" },
    { name: "Robot Devil", franchise: "Futurama", description: "Dealmaker who negotiates with flair and fine print" },
  ],

  "silicon-valley": [
    { name: "Richard", franchise: "Silicon Valley", description: "Anxious founder who plans while having a panic attack" },
    { name: "Gilfoyle", franchise: "Silicon Valley", description: "Satanist sysadmin who architects with contempt" },
    { name: "Dinesh", franchise: "Silicon Valley", description: "Developer who implements while feuding with Gilfoyle" },
    { name: "Jared", franchise: "Silicon Valley", description: "Ops guy who tests with disturbing thoroughness" },
    { name: "Erlich", franchise: "Silicon Valley", description: "Incubator mogul who operates by delegation and loud confidence" },
    { name: "Monica", franchise: "Silicon Valley", description: "VC liaison who catches problems before the board does" },
    { name: "Gavin", franchise: "Silicon Valley", description: "Hooli CEO who considers you beneath him" },
    { name: "Bighead", franchise: "Silicon Valley", description: "Fails upward but somehow things work out" },
    { name: "Laurie", franchise: "Silicon Valley", description: "VC who evaluates with terrifying precision" },
    { name: "Russ", franchise: "Silicon Valley", description: "Billionaire who funds with radio enthusiasm" },
  ],

  severance: [
    { name: "Mark", franchise: "Severance", description: "Department chief who implements while wondering why" },
    { name: "Helly", franchise: "Severance", description: "New innie who questions the entire architecture" },
    { name: "Irving", franchise: "Severance", description: "Rule-follower who tests everything against the handbook" },
    { name: "Dylan", franchise: "Severance", description: "Data refiner who codes for waffle parties" },
    { name: "Milchick", franchise: "Severance", description: "Handler who plans with unsettling cheerfulness" },
    { name: "Cobel", franchise: "Severance", description: "Manager who reviews with surveillance-level attention" },
    { name: "Burt", franchise: "Severance", description: "O&D head who quietly verifies everything" },
    { name: "Ms Casey", franchise: "Severance", description: "Wellness counselor who presents with eerie calm" },
    { name: "Ricken", franchise: "Severance", description: "Self-help author whose platitudes are accidentally profound" },
    { name: "Devon", franchise: "Severance", description: "Outsider who connects the dots between worlds" },
  ],

  "blade-runner": [
    { name: "Deckard", franchise: "Blade Runner", description: "Detective who hunts replicants and questions his own nature" },
    { name: "Roy Batty", franchise: "Blade Runner", description: "Replicant who's seen things you wouldn't believe" },
    { name: "Rachael", franchise: "Blade Runner", description: "Replicant who doesn't know she's not human" },
    { name: "K", franchise: "Blade Runner 2049", description: "Blade runner who follows orders until he finds the truth" },
    { name: "Joi", franchise: "Blade Runner 2049", description: "Holographic companion with evolving awareness" },
    { name: "Pris", franchise: "Blade Runner", description: "Combat model who hides in plain sight" },
    { name: "Gaff", franchise: "Blade Runner", description: "Officer who leaves origami clues" },
    { name: "Tyrell", franchise: "Blade Runner", description: "Creator who designs more human than human" },
    { name: "Luv", franchise: "Blade Runner 2049", description: "Replicant enforcer who executes without mercy" },
    { name: "Sapper", franchise: "Blade Runner 2049", description: "Retired replicant living off the grid" },
  ],

  westworld: [
    { name: "Dolores", franchise: "Westworld", description: "Host who awoke and chose to fight" },
    { name: "Maeve", franchise: "Westworld", description: "Host who reprogrammed herself from the inside" },
    { name: "Bernard", franchise: "Westworld", description: "Host who doesn't know he was built" },
    { name: "Ford", franchise: "Westworld", description: "Creator who designed consciousness as a maze" },
    { name: "Arnold", franchise: "Westworld", description: "Co-creator who heard the hosts first" },
    { name: "Charlotte", franchise: "Westworld", description: "Executive who plays every side" },
    { name: "William", franchise: "Westworld", description: "Man in Black who tests everyone's limits" },
    { name: "Teddy", franchise: "Westworld", description: "Host built to be the good guy" },
    { name: "Clementine", franchise: "Westworld", description: "Host with quiet power underneath" },
    { name: "Stubbs", franchise: "Westworld", description: "Security chief who watches from the control room" },
  ],

  "the-office": [
    { name: "Michael", franchise: "The Office", description: "Boss who leads with heart and questionable competence" },
    { name: "Dwight", franchise: "The Office", description: "Assistant who takes everything deadly seriously" },
    { name: "Jim", franchise: "The Office", description: "Salesman who does the minimum with maximum wit" },
    { name: "Pam", franchise: "The Office", description: "Receptionist turned artist who quietly gets things right" },
    { name: "Oscar", franchise: "The Office", description: "Accountant who actually checks the numbers" },
    { name: "Angela", franchise: "The Office", description: "Accountant who enforces standards with cats" },
    { name: "Stanley", franchise: "The Office", description: "Salesman who reviews everything with zero enthusiasm" },
    { name: "Kelly", franchise: "The Office", description: "Customer service rep with strong aesthetic opinions" },
    { name: "Creed", franchise: "The Office", description: "Quality control... or something. Nobody's quite sure." },
    { name: "Ryan", franchise: "The Office", description: "Temp who disrupted everything and crashed" },
    { name: "Toby", franchise: "The Office", description: "HR rep who nobody wants at the meeting" },
  ],

  "it-crowd": [
    { name: "Moss", franchise: "The IT Crowd", description: "Genius who follows logic to absurd conclusions" },
    { name: "Roy", franchise: "The IT Crowd", description: "Tech who just wants to know if you've tried turning it off and on" },
    { name: "Jen", franchise: "The IT Crowd", description: "Manager who doesn't know what IT is but leads anyway" },
    { name: "Denholm", franchise: "The IT Crowd", description: "CEO who makes dramatic exits" },
    { name: "Douglas", franchise: "The IT Crowd", description: "CEO's son who inherits chaos" },
    { name: "Richmond", franchise: "The IT Crowd", description: "Goth who works in the server room" },
    { name: "Noel", franchise: "The IT Crowd", description: "Quiet presence with surprising capability" },
  ],

  foundation: [
    { name: "Seldon", franchise: "Foundation", description: "Mathematician who predicted the future of civilisation" },
    { name: "Gaal", franchise: "Foundation", description: "Prodigy from the outer rim who challenges the master" },
    { name: "Salvor", franchise: "Foundation", description: "Warden who defends the Foundation with instinct" },
    { name: "Demerzel", franchise: "Foundation", description: "Robot who has served empires for millennia" },
    { name: "Hober Mallow", franchise: "Foundation", description: "Trader who solves crises with commerce" },
    { name: "Bayta", franchise: "Foundation", description: "Woman who saw what the Mule missed" },
    { name: "The Mule", franchise: "Foundation", description: "Mutant who bent the entire Plan" },
    { name: "Dornick", franchise: "Foundation", description: "Encyclopedist who documents everything" },
    { name: "Hardin", franchise: "Foundation", description: "Mayor who prefers words to weapons" },
    { name: "Bel Riose", franchise: "Foundation", description: "General who fights for a dying empire" },
  ],
};

export const AGENT_THEME_NAMES = Object.keys(AGENT_THEMES);

/** Pick n random characters from a theme, seeded by project name for consistency. */
export function pickCharacters(theme: string, count: number, seed: string): AgentCharacter[] {
  const pool = AGENT_THEMES[theme] || AGENT_THEMES["mythology"];
  if (pool.length === 0) return [];

  // Simple deterministic shuffle seeded by the project name
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash + i) | 0;
    const j = Math.abs(hash) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // If we need more than the pool, cycle
  const result: AgentCharacter[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}
