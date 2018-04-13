ajk.OperationExecution = class
{
    constructor(opManager, operation, targetYield)
    {
        this.operation   = operation;
        this.targetYield = targetYield;
        this.targets     = Object.keys(operation.dependencies).map(d => new ajk.TargetFulfillment(opManager, d, operation.dependencies[d]));
    }
    update()
    {

    }
};

ajk.TargetFulfillment = class
{
    constructor(opManager, targetId, quantity)
    {
        this.targetId    = targetId;
        this.quantity    = quantity;
        this.operations  = opManager.getOperationsFor(this.targetId).map(o => new ajk.OperationExecution(opManager, o));
    }
    update()
    {
        this.branches = [];
        this.timeLeft = Infinity;
        this.complete = false;

        // Get the target data
        var target = opManager.getTarget(this.targetId);
        if (target == null)
        {
            throw 'Target not found for \'' + targetId + '\'';
        }

        // Determine deficit
        this.deficit = target.deficit(this.quantity);
        if (deficit == 0)
        {
            this.complete = true;
            this.timeLeft = 0;
            return;
        }

        // Accumulate target consumption

        // Collect operation branches

            // Number of times this operation must be performed to reach the target deficit

            // Update the operation

            // Collect operation stats

            // Rewind operation consumption

        // Choose optimal branch

        // Reapply branch consumption
    }
};