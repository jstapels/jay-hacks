const MODULE_ID = "auto-effects";

const DEFAULT_CONFIG = [
    {
        conditions: ["(@attributes.hp.value / @attributes.hp.max) <= 1/3",
                     "(@attributes.hp.value / @attributes.hp.max) > 0"],
        flags: {mustNotBeDead: true},
        effect: {
            label: "Bloody",
            icon: `modules/${MODULE_ID}/images/bloody-stash.svg`,
            flags: { core: { overlay: true, statusId: "Bloody" }}
        }
    },
    {
        conditions: ["(@attributes.hp.value / @attributes.hp.max) <= 2/3",
                     "(@attributes.hp.value / @attributes.hp.max) > 1/3"],
        flags: {mustNotBeDead: true},
        effect: {
            label: "Wounded",
            icon: `modules/${MODULE_ID}/images/bleeding-wound.svg`,
            flags: { core: { overlay: true, statusId: "Wounded" }}
        }
    },
    {
        conditions: ["@attributes.hp.value <= 0"],
        flags: {mustNotBeDead: true},
        effect: {
            label: "Dying",
            icon: `modules/${MODULE_ID}/images/pummeled.svg`,
            flags: { core: { overlay: true, statusId: "Dying" }}
        }
    },
];


function log(...args) {
    console.log(`${MODULE_ID} |`, ...args);
}


class AutoEffects {

    #config = null;
    get config() {
        return this.#config ?? DEFAULT_CONFIG;
    }

    constructor() {
    }

    initHook() {
        log("initHook");
    }

    readyHook() {
        log("readyHook");
    }

    async updateActorHook(actor, diff, options, userID) {
        log("updateActorHook", actor);
        if (game.users.activeGM) {
            this.config.forEach(cfg => this.actorConfigCheck(actor, cfg, diff));
        }
    }

    async actorConfigCheck(actor, cfg, diff) {
        let checks = cfg.conditions;
        let matches = checks.every(c => this.evaluate(actor, c));
        let allow = ! (cfg.flags?.mustNotBeDead && (diff?.defeated ?? this.defeated(actor)));
        if (matches && allow) {
            await this.applyEffect(actor, cfg.effect);
        } else {
            await this.removeEffect(actor, cfg.effect);
        }
    }

    async applyEffect(actor, effect) {
        log("applyEffect", actor, effect);
        let existing = actor.effects.find(e => e.label === effect.label);
        if (! existing) {
            await ActiveEffect.create(effect, {parent:actor});
        }
    }

    async removeEffect(actor, effect) {
        log("removeEffect", actor, effect);
        let existing = actor.effects.find(e => e.label === effect.label);
        if (existing) {
            await existing.delete();
        }
    }

    evaluate(actor, expression) {
        log("evaluate", actor, expression);
        let formula = Roll.replaceFormulaData(expression, actor.getRollData());
        return Roll.safeEval(formula);
    }

    defeated(actor) {
        return actor.getActiveTokens()
                    .every(tok => tok.combatant?.isDefeated);
    }
}

const autoEffects = new AutoEffects();

Hooks.once("init", () => autoEffects.initHook());
Hooks.once("ready", () => autoEffects.readyHook());
Hooks.on("updateActor", (actor, diff, options, userID) => autoEffects.updateActorHook(actor, diff, options, userID));
Hooks.on("updateCombatant", (combatant, diff, options, userID) => autoEffects.updateActorHook(combatant.actor, diff, options, userID));

