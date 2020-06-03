//
// Wall Fix Module for Foundry VTT
//
// Author: Jason Stapels
// GitHub: https://github.com/jstapels/foundry-vtt/wall-fix
//

/**
 * A utility that makes moving the endpoint of walls a little more interactive.
 */
class WallFix {
    // Current version.
    static VERSION = "0.1";
    
    // New wall drag resistance (in pixels).
    static dragResistance = 5;

    static init() {
        console.log("WallFix | Version " + WallFix.VERSION);

        // Patch code for all new walls.
        let origFunc = Wall.prototype.activateListeners;
        Wall.prototype.activateListeners = function() {
            origFunc.call(this);
            this.mouseInteractionManager.options.dragResistance = WallFix.dragResistance;
        };
        console.log("WallFix | Patched interaction behavior for walls");

        console.log("WallFix | Complete!");
    }
}

Hooks.once('init', WallFix.init);
