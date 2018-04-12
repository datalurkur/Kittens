'use strict';

ajk.Core = class
{
    constructor()
    {
        this.targetsCache    = {};
        this.operationsCache = {};
    }
    rebuildCache()
    {
        this.targetsCache = {};
        ajk.TargetProviders.forEach((provider) =>
        {
            provider.getTargets().forEach((target) => {
                if (this.targetsCache.hasOwnProperty(target.id)) { throw 'Duplicate target ID: \'' + target.id + '\''; }
                this.targetsCache[target.id] = target;
            });
        });

        this.operationsCache = {};
        ajk.OperationProviders.forEach((provider) => {
            provider.getOperations().forEach((operation) => {
                if (!this.operationsCache.hasOwnProperty(operation.targetId)) { this.operationsCache[operation.targetId] = []; }
                this.operationsCache[operation.targetId].push(operation);
            })
        })
    }
};