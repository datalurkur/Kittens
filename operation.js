'use strict';

ajk.operations = {
    log: ajk.log.addChannel('ops', false),
};

// Represents an action that can be performed in order to satisfy a requirement / produce a resource / some other outcome
ajk.operations.Operation = class
{
    constructor(method, target, dependencies)
    {
        this.method       = method;
        this.target       = target;
        this.dependencies = dependencies;
    }
    // Attempts to produce the specified amount of the target resource
    // Returns the number of resulting target resource on success, or null on failure
    execute(result)
    {
        ajk.operations.log.warn('Operation has no execution method');
        return null;
    }
};

ajk.operations.SacrificeUnicornsOperation = class extends ajk.operations.Operation
{
    constructor()
    {
        super('sacrifice', 'tears', {'unicorns': 2500});
    }
    execute(result)
    {
        var ratio = gamePage.bld.get('ziggurat').value;
        var required = result / ratio;
        var allowed = gamePage.resPool.get('unicorns') / 2500;
        var actual = Math.min(required, allowed);
        var btn = gamePage.religionTab.sacrificeBtn;
        return (btn.controller.sacrifice(btn.model, actual)) ? (actual * ratio) : null;
    }
};

ajk.operations.SacrificeAlicornsOperation = class extends ajk.operations.Operation
{
    constructor()
    {
        super('sacrifice', 'timeCrystal', {'alicorns': 25});
    }
    execute(result)
    {
        var allowed = gamePage.resPool.get('alicorns') / 25;
        var actual = Math.min(result, allowed);
        var btn = gamePage.religionTab.sacrificeAlicornBtn;
        return (btn.controller.sacrifice(btn.model, actual)) ? actual : null;
    }
};

ajk.operations.PurchaseItemOperation = class extends ajk.operations.Operation
{
    constructor(item)
    {
        var deps = {};
        item.model.prices.map(p => deps[p.name] = p.val);
        super('purchase', item.model.metadata.name, deps);

        this.item = item;
    }
    execute()
    {
        var success = false;
        this.item.controller.buyItem(item.model, {}, function(result) {
            success |= result;
        });
        return success ? 1 : null;
    }
};

ajk.operations.OperationsManager = class
{
    constructor()
    {
        this.resetOperations();
    }
    resetOperations()
    {
        this.operations = {};
    }
    addOperation(target, operation)
    {
        ajk.util.ensureKey(this.operations, target, []).push(operation);
    }
};