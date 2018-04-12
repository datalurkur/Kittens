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
    constructor(targetId)
    {
        this.targetId = targetId;
    }
};

ajk.OperationProvider = class
{
    getOperations() { return []; }
};
ajk.OperationProviders = [];