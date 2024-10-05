const MODULE_ID = 'jay-hacks';

// Eventually these should be in a config page.
const SETTING_HOTBAR_PAGE = 'hotbarPage';
const SETTING_ONLY_GMS = 'onlyGMs';
const SETTING_ACTIVATION_ACTION = 'action';
const SETTING_ACTIVATION_BONUS = 'bonus';
const SETTING_ACTIVATION_REACTION = 'reaction';
const SETTING_ACTIVATION_SPECIAL = 'special';
const SETTING_ACTIVATION_NONE = 'none';
const SETTING_ACTIVATION_EMPTY = 'empty';

const ACTION_LOOKUP = new Map([
  [SETTING_ACTIVATION_ACTION, 'action'],
  [SETTING_ACTIVATION_BONUS, 'bonus'],
  [SETTING_ACTIVATION_REACTION, 'reaction'],
  [SETTING_ACTIVATION_SPECIAL, 'special'],
  [SETTING_ACTIVATION_NONE, 'none'],
]);

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
  if (!item?.system?.activaties?.size) {
    return game.settings.get(MODULE_ID, SETTING_ACTIVATION_EMPTY);
  }

  const allowedActions = ACTION_LOOKUP.entries()
    .filter(([k]) => game.settings.get(MODULE_ID, k))
    .map(([, v]) => v);
  const actionTypes = [...allowedActions];
  return item?.system?.activities?.values()
    .some((a) => actionTypes.includes(a.activation.type))
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

  const hotbarPage = game.settings.get(MODULE_ID, SETTING_HOTBAR_PAGE);
  const freeSlots = game.user.getHotbarMacros(hotbarPage)
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
  const hotbarPage = game.settings.get(MODULE_ID, SETTING_HOTBAR_PAGE);
  const macroIds = game.user.getHotbarMacros(hotbarPage)
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
  const onlyGms = game.settings.get(MODULE_ID, SETTING_ONLY_GMS);
  if (onlyGms && !game.user.isGM) return;

  if (selected) {
    workQueue = workQueue.then(() => tokenSelected(token));
  } else {
    workQueue = workQueue.then(() => tokenDeselected(token));
  }
};

const initHook = () => {
  log('Initialization settings');

  game.settings.register(MODULE_ID, SETTING_HOTBAR_PAGE, {
    name: game.i18n.localize(`${MODULE_ID}.settings.selectHotbarPage.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.selectHotbarPage.hint`),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: Number,
    choices: {
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
    },
    default: 5,
  });
  game.settings.register(MODULE_ID, SETTING_ONLY_GMS, {
    name: game.i18n.localize(`${MODULE_ID}.settings.onlyGMs.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.onlyGMs.hint`),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_ACTION, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationAction.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationAction.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_BONUS, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationBonus.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationBonus.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_REACTION, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationReaction.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationReaction.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_SPECIAL, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationSpecial.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationSpecial.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_NONE, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationNone.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationNone.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, SETTING_ACTIVATION_EMPTY, {
    name: game.i18n.localize(`${MODULE_ID}.settings.activationEmpty.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.activationEmpty.hint`),
    scope: 'world',
    config: true,
    requiresReload: false,
    type: Boolean,
    default: false,
  });
};

/**
 * Called when Foundry is ready to go.
 */
const readyHook = () => {
  log('Ready');
  Hooks.on('controlToken', controlTokenHook);
};

Hooks.once('init', () => initHook());
Hooks.once('ready', () => readyHook());

