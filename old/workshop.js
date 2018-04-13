ajk.operations.CraftOperation = class extends ajk.operations.Operation
{
    constructor(craft)
    {
        super('craft', craft.name, craft.prices);
    }
    execute(result)
    {
        var required = Math.ceil(result / (1 + gamePage.getCraftRatio()));
        var allowed = gamePage.workshop.getCraftAllCount(this.target);
        var actual = Math.min(required, allowed);
        if (gamePage.workshop.craft(this.target, actual))
        {
            return actual * (1 + gamePage.getCraftRatio());
        }
        else
        {
            return null;
        }
    }
};

ajk.Workshop = class
{
    constructor()
    {

    }
    collectOperations(opManager)
    {
        if (!gamePage.workshopTab.visible) { return; }
        gamePage.workshop.crafts.forEach((craft) => {
            // TODO - Figure out when things are actually available versus "unlocked"
            if (craft.unlocked)
            {
                opManager.addOperation(craft.name, new ajk.operations.CraftOperation(craft));
            }
        }); 
    }
};