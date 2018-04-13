ajk.WorkshopUpgradeTarget = class extends ajk.Target
{
    constructor(upgrade)
    {
        super('upgrades_' + upgrade.name);
        this.upgrade = upgrade;
    }
    deficit(targetYield)
    {
        return this.upgrade.researched ? 0 : 1;
    }
};

ajk.WorkshopUpgradeTargetProvider = class extends ajk.TargetProvider
{
    static getTargets()
    {
        return gamePage.workshop.upgrades.map(u => new ajk.WorkshopUpgradeTarget(u));
    }
};
ajk.TargetProviders.push(ajk.WorkshopUpgradeTargetProvider);

ajk.CraftResourceOperation = class extends ajk.Operation
{
    constructor(cache, craft)
    {
        var deps = {};
        if (!gamePage.workshopTab.visible)
        {
            deps['tabs_workshop'] = 1;
        }
        else if (!craft.unlocked)
        {
            var unlocker = cache.unlockedBy['crafts_' + craft.name];
            if (unlocker == null)
            {
                throw 'No unlockedBy data found for craft \'' + craft.name + '\'';
            }
            deps[unlocker] = 1;
        }
        else
        {
            deps = ajk.ResourceOperationProvider.getPriceDependencies(craft.prices);
        }
        super(craft.name, deps);
    }
    execute(targetYield)
    {
        var expectedYield = (1 + gamePage.getCraftRatio());
        var desired = Math.ceil(targetYield / expectedYield);
        var allowed = gamePage.workshop.getCraftAllCount(this.id);
        var actual  = Math.min(desired, allowed);
        if (!gamePage.workshop.craft(this.id, actual))
        {
            throw 'Failed to perform crafting operation';
        }
        return actual * expectedYield;
    }
};

ajk.WorkshopUpgradeOperation = class extends ajk.Operation
{
    constructor(cache, upgrade)
    {
        var id = 'upgrades_' + upgrade.name;
        var deps = {};
        if (!upgrade.unlocked)
        {
            var unlocker = cache.unlockedBy[id];
            if (unlocker == null)
            {
                // Certain unlocks are currently not unlockable via gameplay and must be unlocked via cheating, which we don't intend to do
                //throw 'No unlockedBy data found for upgrade \'' + upgrade.name + '\'';
                deps['impossible'] = 1;
            }
            else
            {
                deps[unlocker] = 1;
            }
        }
        else
        {
            deps = ajk.ResourceOperationProvider.getPriceDependencies(upgrade.prices);
        }
        super(id, deps);
    }
    execute(targetYield)
    {
        // TODO
    }
};

ajk.WorkshopOperationProvider = class extends ajk.OperationProvider
{
    static getOperations(effectCache)
    {
        var operations = [];
        gamePage.workshop.crafts.forEach((craft) => {
            operations.push(new ajk.CraftResourceOperation(effectCache, craft));
        });
        gamePage.workshop.upgrades.forEach((upgrade) => {
            if (!upgrade.researched)
            {
                operations.push(new ajk.WorkshopUpgradeOperation(effectCache, upgrade));
            }
        })
        return operations;
    }
};
ajk.OperationProviders.push(ajk.WorkshopOperationProvider);