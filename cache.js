ajk.EffectCache = class
{
    constructor()
    {
        this.unlockedBy = {};

        // These won't change as the game progresses
        // Buildings don't unlock anything interesting at the moment, but they might eventually
        this._collectUnlocks('buildings_', gamePage.bld.buildingsData);
        this._collectUnlocks('tech_', gamePage.science.techs);
        this._collectUnlocks('upgrades_', gamePage.workshop.upgrades);
        this._collectUnlocks('perks_', gamePage.prestige.perks);
        // TODO - Add more unlocky stuff
    }
    build()
    {
        // TODO - Add storage / production / drain
    }
    _collectUnlocks(prefix, items)
    {
        items.forEach((item) => {
            Object.keys(item.unlocks || {}).forEach((category) => {
                item.unlocks[category].forEach((unlock) => {
                    if (category == 'stages')
                    {
                        this.unlockedBy[category + '_' + unlock.bld + '_' + unlock.stage] = prefix + item.name;
                    }
                    else
                    {
                        this.unlockedBy[category + '_' + unlock] = prefix + item.name;
                    }
                });
            })
        })
    }
};