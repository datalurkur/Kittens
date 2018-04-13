'use strict';

ajk.Core = class
{
    constructor()
    {
        this.effectCache = new ajk.EffectCache();
        this.opManager = new ajk.OperationManager(ajk.TargetProviders, ajk.OperationProviders);
    }
    rebuildCache()
    {
        this.opManager.rebuild(this.effectCache);
    }
};

// DEBUG
function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function test()
{
    await sleep(1000);
    var ajkC = new ajk.Core();
    ajkC.rebuildCache();
    var d = new ajk.TargetFulfillment(ajkC.opManager, 'hut', 1);
}
test();