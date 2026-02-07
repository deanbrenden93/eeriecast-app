/**
 * Curated show & audiobook descriptions.
 * Used as a frontend fallback when the API doesn't supply a description
 * (or when the server-side copy is just shorthand RSS boilerplate).
 *
 * Keyed by lowercase show title for easy lookup.
 */

const SHOW_DESCRIPTIONS = {
  "drakenblud: the malformed king": `Inspired by the gothic nightmare aesthetic of Bloodborne, this dark fantasy novel plunges readers into a world of blood, grotesque monsters, and a mystery wrapped in royal corruption. A malformed king sits at the center of a kingdom rotting from the inside, and the adventure to reach him is as brutal as it is mesmerizing. It's Eeriecast's first foray into original fiction — and it reads like a fever dream with teeth.`,

  "unexplained encounters": `Ordinary people from around the world submit their most terrifying brushes with the impossible — and Darkness Prevails narrates every unnerving detail. From werewolf sightings in national forests to ghostly apparitions that defy rational explanation, each episode dares you to keep the lights off. The only question that matters here isn't what these people encountered — it's whether you'll still be a skeptic by the end.`,

  "freaky folklore": `Carman Carrion digs into the ancient graves of global mythology to exhume the monsters humanity has feared for millennia — and the disturbing reasons we created them. Each episode peels back the cultural skin of a different creature, from bone-collecting Yetis to death-heralding White Ladies haunting European castles. This isn't just folklore — it's a mirror reflecting what terrifies the human soul across every civilization on Earth.`,

  "redwood bureau": `A rogue agent known only as Conroy has gone on the run from a shadowy government organization called the Redwood Bureau — and he's leaking their classified supernatural case files to the public. Each episode reveals another entity the Bureau captured, studied, or lost control of, usually at a devastating human cost. Part sci-fi thriller, part creepypasta nightmare, this fiction podcast blurs the line between what's scripted and what feels disturbingly plausible.`,

  "tales from the break room": `You clock in, you do your job, you go home — unless something unexplainable has other plans for your shift. Real workers from every industry submit their most horrifying on-the-clock encounters, from haunted hospitals to things lurking in the back of convenience stores after midnight. This podcast will make you reconsider every strange noise you've ever brushed off at work.`,

  "alone in the woods": `The wilderness is beautiful, serene, and full of things that don't want you there. NaturesTemper narrates allegedly true accounts from hikers, campers, and outdoorsmen who ventured too deep and came back with stories they can barely bring themselves to tell. Every episode is a campfire tale backed by the raw, shaky conviction of someone who swears it actually happened to them.`,

  "destination terror": `Carman Carrion travels the globe — without ever leaving the microphone — to investigate the blood-soaked histories behind the world's most haunted locations. From crumbling asylums to cursed islands, each episode unearths why certain places became magnets for the macabre. The real terror isn't the ghosts that supposedly linger — it's what happened there to create them.`,

  "manmade monsters": `GenSen wanders into the weird, the creepy, and the deeply unsettling corners of human-made horror, with the occasional call-in from listeners brave enough to share. The show thrives in that uneasy space where urban legends, conspiracies, and genuine strangeness collide. If the woods are scary, what humanity builds in the dark is worse.`,

  "night watchers": `Darkness and friends gather around a table in someone's mom's basement and discuss the creepy, the weird, and the downright hilarious. Expect pop culture discussion, scary stories, and deliciously laughable tales centering around all things weird.`,

  "lore": `Four friends fly into the remote Alaskan wilderness for an ice fishing trip, but when gruesome "gifts" appear on their cabin porch and their vehicle is sabotaged, the getaway becomes a waking nightmare fueled by ancient Yupik spirits hungry for chaos. Trapped in a forest that warps both compass and sanity, the men's friendships fracture under the weight of dark secrets, impossible choices, and a vengeful presence stalking them from the tree line. This supernatural thriller keeps you guessing until a shocking conclusion — and serves as a reminder that the wilderness was never yours to begin with.`,

  "dogwood": `In 1940s Georgia, two young girls vanish from their beds at Dogwood Plantation, and the small town of Wellspring would rather blame the beasts in the woods than confront the dark curse — and a mysterious herb called Legatum — festering beneath their soil. A hardboiled private eye haunted by his own demons and a criminal justice professor running from her past must untangle a web of secrets, lies, and murder that stretches back through the plantation's twisted legacy. The deeper they dig, the more they discover that the true monsters are terrifyingly human — and that Dogwood's crops crave flesh.`,
};

/**
 * Look up a curated description for a show by title.
 * Returns the curated copy, or null if none exists.
 */
export function getShowDescription(show) {
  if (!show) return null;
  const title = (show.title || show.name || "").toLowerCase().trim();
  if (!title) return null;

  // Exact match first
  if (SHOW_DESCRIPTIONS[title]) return SHOW_DESCRIPTIONS[title];

  // Containment match (e.g. "LORE - A Folklore Horror Novel" contains key "lore")
  for (const [key, desc] of Object.entries(SHOW_DESCRIPTIONS)) {
    if (title.includes(key) || key.includes(title)) return desc;
  }

  return null;
}

export default SHOW_DESCRIPTIONS;
