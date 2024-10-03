// import { id as MODULE_ID } from '../module.json';

const MODULE_ID = 'jay-hacks';

// Eventually these should be in a config page.
const HOTBAR_MACRO_PAGE = 5;
const ONLY_GMS = true;
const ACTION_TYPES = ['action', 'bonus', 'reaction', 'special'];

let workQueue = Promise.resolve();

/**
 * Log to the console.
 * 
 * @param  {...any} args log parameters
 */
const log = (...args) => {
  // eslint-disable-next-line no-console
  console.log(`${MODULE_ID} |`, ...args);
};


/**
 * Check if an item is "usable" based on the type of action action that is required to use it.
 * Note: This is specific to the dnd5e system.
 * 
 * @param {Item} item the item to check.
 * @returns 
 */
const isItemAction = (item) => {
  return item?.system?.activities?.values()
    .some((a) => ACTION_TYPES.includes(a.activation.type))
    ?? false;
};

const createMacroData = (item) => {
  return {
    type: "script",
    scope: "actor",
    name: item.name,
    img: item.img,
    command: `(await fromUuid("${item.uuid}"))?.use()`,
    flags: { [MODULE_ID]: { autoMacro: true } },
  };
};

const tokenSelected = async (token) => {
  log(`Token ${token.name} selected.`);

  let items = Array.from(token.actor?.items?.values() ?? []);

  // See if favorites are available
  if (token.actor?.system?.favorites?.length) {
    const favorites = token.actor.system.favorites;

    // Favorites use relative UUIDs
    const itemByRelUuid = (fav) => items.find((i) => i.getRelativeUUID(token.actor) === fav.id);
    const favItems = favorites.filter((fav) => fav.type === 'item')
      .map(itemByRelUuid);
    items = favItems;
    log('Found favorites', favItems);
  }

  // Filter to just usable items
  items = items.filter(isItemAction);

  // Nothing to do.
  if (!items.length) return;

  const freeSlots = game.user.getHotbarMacros(HOTBAR_MACRO_PAGE)
    .filter((sm) => !sm.macro)
    .map((sm) => sm.slot);

  const macroData = items.slice(0, freeSlots.length)
    .map(createMacroData);

  const macros = await Macro.create(macroData);

  // Update the hotbar in bulk.
  const update = foundry.utils.deepClone(game.user.hotbar);

  for (const macro of macros) {
    const slot = freeSlots.shift();
    log(`Assigning ${macro.name} to hotbar slot ${slot}`);
    update[slot] = macro.id;
  }

  log('Updating hotbar');
  await game.user.update({ hotbar: update }, { diff: false, recursive: false, noHook: true });
};


const destroyMacros = async () => {
  const macroIds = game.user.getHotbarMacros(HOTBAR_MACRO_PAGE)
    .filter((sm) => sm.macro?.getFlag(MODULE_ID, 'autoMacro'))
    .map((sm) => sm.macro.id);

  log('Cleaning macros', macroIds);
  await Macro.deleteDocuments(macroIds);
};

const tokenDeselected = async (token) => {
  log(`Token ${token.name} deselected.`);
  await destroyMacros();
};

const controlTokenHook = async (token, selected) => {
  if (ONLY_GMS && !game.user.isGM) return;

  if (selected) {
    workQueue = workQueue.then(() => tokenSelected(token));
  } else {
    workQueue = workQueue.then(() => tokenDeselected(token));
  }
};


/**
 * Called when Foundry is ready to go.
 */
const readyHook = () => {
  log('Ready');
  Hooks.on('controlToken', controlTokenHook);
};

// Hooks.once('init', () => initHook());
Hooks.once('ready', () => readyHook());

