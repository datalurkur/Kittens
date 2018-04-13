ajk.TabUnlockTarget = class extends ajk.Target
{
    constructor(tab)
    {
        super('tab_' + tab.tabId.toLowerCase());
        this.tab = tab;
    }
    deficit() { return this.tab.visible ? 0 : 1; }
};

ajk.AdvancementTargetProvider = class extends ajk.TargetProvider
{
    static getTargets()
    {
        var targets = [
            new ajk.TabUnlockTarget(gamePage.workshopTab),
            new ajk.TabUnlockTarget(gamePage.tabs[2]),
            new ajk.TabUnlockTarget(gamePage.diplomacyTab),
            new ajk.TabUnlockTarget(gamePage.religionTab),
            new ajk.TabUnlockTarget(gamePage.spaceTab)
        ];
        return targets;
    }
};
ajk.TargetProviders.push(ajk.AdvancementTargetProvider);

ajk.AdvancementOperationProvider = class extends ajk.OperationProvider
{
    static getOperations(effectCache)
    {
        var operations = [
            new ajk.Operation('tab_workshop',  {'buildings_workshop': 1}),
            new ajk.Operation('tab_science',   {'buildings_library': 1}),
            new ajk.Operation('tab_trade',     {'buildings_tradepost': 1, 'year': this._tradeUnlockYear()}),
            new ajk.Operation('tab_religion',  {'tech_theology': 1}),
            new ajk.Operation('tab_space',     {'tech_rocketry': 1})
        ];
        return operations;
    }
    static _tradeUnlockYear()
    {
       if (gamePage.prestige.getPerk('diplomacy').researched) { return 1; }
       if (gamePage.resPool.get('karma').value > 0) { return 5; }
       return 20;
    }
};
ajk.OperationProviders.push(ajk.AdvancementOperationProvider);