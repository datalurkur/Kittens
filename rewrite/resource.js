ajk.ResourceTarget = class extends ajk.Target
{
    constructor(name, available)
    {
        super(name);
        this.available = available;
    }
};

ajk.ResourceStorageTarget = class extends ajk.Target
{
    constructor(name, storage)
    {
        super(name);
        this.storage = storage;
    }
};

ajk.ResourceProductionTarget = class extends ajk.Target
{
    constructor(name, perTick)
    {
        super(name);
        this.perTick = perTick;
    }
};

ajk.ResourceTargetProvider = class extends ajk.TargetProvider
{
    getTargets()
    {
        var targets = [];
        gamePage.resPool.resources.forEach((resource) => {
            targets.push(new ajk.ResourceTarget(resource.name, resource.value));
            if (resource.maxValue > 0)
            {
                targets.push(new ajk.ResourceStorageTarget(resource.name + 'Storage', resource.maxValue));
            }
            targets.push(new ajk.ResourceProductionTarget(resource.name + 'Production', resource.perTickCached));
        });
        return targets;
    }
};
ajk.TargetProviders.push(new ajk.ResourceTargetProvider());

ajk.AccumulateResourceOperation = class extends ajk.Operation
{

};

ajk.ResourceOperationProvider = class extends ajk.OperationProvider
{
    getOperations()
    {
        var operations = [];
        gamePage.resPool.resources.forEach((resource) => {
        });
        return operations;
    }
};
ajk.OperationProviders.push(new ajk.ResourceOperationProvider());