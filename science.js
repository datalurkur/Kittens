ajk.TechTarget = class extends ajk.Target
{
    constructor(tech)
    {
        super('tech_' + tech.name);
        this.tech = tech;
    }
    deficit(targetYield)
    {
        return this.tech.researched ? 0 : 1;
    }
};

ajk.TechTargetProvider = class extends ajk.TargetProvider
{
    static getTargets()
    {
        return gamePage.science.techs.map(t => new ajk.TechTarget(t));
    }
};
ajk.TargetProviders.push(ajk.TechTargetProvider);

ajk.ResearchOperation = class extends ajk.Operation
{
    constructor(cache, tech)
    {
        var id = 'tech_' + tech.name;
        var deps = {};
        if (!tech.unlocked)
        {
            var unlocker = cache.unlockedBy[id];
            if (unlocker == null)
            {
                // Certain unlocks are currently not unlockable via gameplay and must be unlocked via cheating, which we don't intend to do
                throw 'No unlockedBy data found for upgrade \'' + tech.name + '\'';
                //deps['impossible'] = 1;
            }
            else
            {
                deps[unlocker] = 1;
            }
        }
        else
        {
            deps = ajk.ResourceOperationProvider.getPriceDependencies(tech.prices);
        }
        super(id, deps);
    }
    execute(targetYield)
    {
        // TODO
    }
};

ajk.ResearchOperationProvider = class extends ajk.OperationProvider
{
    static getOperations(effectCache)
    {
        var operations = [];
        gamePage.science.techs.forEach((tech) => {
            if (!tech.researched)
            {
                operations.push(new ajk.ResearchOperation(effectCache, tech));
            }
        })
        return operations;
    }
};
ajk.OperationProviders.push(ajk.ResearchOperationProvider);