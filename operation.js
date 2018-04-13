/*
    An operation is any action that is performed that results in a target output
    This includes:
        Waiting for a certain amount of a resource to accumulate
        Purchasing a structure
        Praising the sun
        Exploring
        Trading
        Crafting
    There are often multiple operations with the same target output (but likely with different output magnitudes)
    Examples:
        Multiple structure purchases might provide storage for a given resource
        A given resource might be acquired via waiting, trading, or crafting
        Multiple structures might produce a given resource
*/
ajk.Operation = class
{
    constructor(targetId, dependencies)
    {
        this.targetId     = targetId;
        this.dependencies = dependencies;
    }
    execute(targetYield) { return targetYield; }
};

ajk.WaitForYearOperation = class extends ajk.Operation
{
    constructor(year)
    {
        super('year', []);
    }
    execute(targetYield) { return gamePage.calendar.year; }
};

ajk.OperationProvider = class
{
    static getOperations() { return []; }
};
ajk.OperationProviders = [];

ajk.OperationManager = class
{
    constructor(targetProviders, operationProviders)
    {
        this.targetProviders    = targetProviders;
        this.operationProviders = operationProviders;

        this.targets    = {};
        this.operations = {};
    }
    getTarget(id)        { return this.targets[id] || null;  }
    getOperationsFor(id) { return this.operations[id] || []; }
    rebuild(effectCache)
    {
        this.targets = {};
        this.targets['impossible'] = new ajk.ImpossibleTarget();
        this.targetProviders.forEach((provider) =>
        {
            provider.getTargets().forEach((target) => {
                if (this.targets.hasOwnProperty(target.id)) { throw 'Duplicate target ID: \'' + target.id + '\''; }
                this.targets[target.id] = target;
            });
        });

        this.operations = {};
        this.operationProviders.forEach((provider) => {
            provider.getOperations(effectCache).forEach((operation) => {
                if (!this.operations.hasOwnProperty(operation.targetId)) { this.operations[operation.targetId] = []; }
                this.operations[operation.targetId].push(operation);
            })
        })
    }
};