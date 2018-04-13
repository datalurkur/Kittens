ajk.ResourceTarget = class extends ajk.Target
{
    constructor(resourceName, idName)
    {
        super(idName || resourceName);
    }
    deficit(quantity)
    {
        return Math.max(0, quantity - this._get());
    }
    _get() { return gamePage.resPool.get(this.id).value; }
};

ajk.ResourceStorageTarget = class extends ajk.ResourceTarget
{
    constructor(resourceName)
    {
        super(resourceName, 'storage_' + resourceName);
        this.resourceName = resourceName;
    }
    _get() { return gamePage.resPool.get(this.resourceName).maxValue; }
};

ajk.ResourceProductionTarget = class extends ajk.ResourceTarget
{
    constructor(resourceName)
    {
        super(resourceName, 'production_' + resourceName);
        this.resourceName = resourceName;
    }
    _get() { return gamePage.resPool.get(this.resourceName).perTickCached; }
};

ajk.ResourceTargetProvider = class extends ajk.TargetProvider
{
    static getTargets()
    {
        var targets = [];
        gamePage.resPool.resources.forEach((resource) => {
            targets.push(new ajk.ResourceTarget(resource.name));
            if (resource.maxValue > 0)
            {
                targets.push(new ajk.ResourceStorageTarget(resource.name));
            }
            targets.push(new ajk.ResourceProductionTarget(resource.name));
        });
        return targets;
    }
};
ajk.TargetProviders.push(ajk.ResourceTargetProvider);

ajk.AccumulateResourceOperation = class extends ajk.Operation
{
    execute(targetYield)
    {
        return gamePage.resPool.get(this.resourceName).value;
    }
};

ajk.ResourceOperationProvider = class extends ajk.OperationProvider
{
    static getPriceDependencies(gamePriceData)
    {
        var deps = {};
        gamePriceData.forEach((price) => {
            if (gamePage.resPool.get(price.name).maxValue > price.val)
            {
                deps['storage_' + price.name] = price.val;
            }
            else
            {
                deps[price.name] = price.val;
            }
        });
        return deps;
    }
    static getOperations(effectCache)
    {
        var operations = [];
        gamePage.resPool.resources.forEach((resource) => {
            if (resource.perTickCached > 0)
            {
                operations.push(new ajk.AccumulateResourceOperation(resource.name, []));
            }
        });
        return operations;
    }
};
ajk.OperationProviders.push(ajk.ResourceOperationProvider);