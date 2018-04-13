ajk.BuildingTarget = class extends ajk.Target
{
    constructor(building)
    {
        super('buildings_' + building.name);
        this.buildingName = building.name;
    }
    deficit(amount)
    {
        return Math.max(0, amount - gamePage.bld.get(this.buildingName).val);
    }
};

ajk.BuildingTargetProvider = class extends ajk.TargetProvider
{
    static getTargets()
    {
        return gamePage.bld.buildingsData.map(b => new ajk.BuildingTarget(b));
    }
};
ajk.TargetProviders.push(ajk.BuildingTargetProvider);

ajk.ConstructBuildingOperation = class extends ajk.Operation
{
    constructor(button)
    {
        var deps = ajk.ResourceOperationProvider.getPriceDependencies(button.model.prices);
        super('buildings_' + button.model.metadata.name, deps);
        this.button = button;
    }
    execute(targetYield)
    {
        var success = false;
        this.button.controller.buyItem(this.button.model, {}, function(result) {
            success |= result;
        });
        return success ? 1 : 0;
    }
};

ajk.ConstructBuildingOperationProvider = class extends ajk.OperationProvider
{
    static getOperations(effectCache)
    {
        ajk.Util.switchTab('Bonfire');
        return gamePage.tabs[0].buttons.filter(b => (typeof b.model.metadata !== 'undefined')).map((button) => {
            return new ajk.ConstructBuildingOperation(button);
        });
    }
}
ajk.OperationProviders.push(ajk.ConstructBuildingOperationProvider);