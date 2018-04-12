ajk.Target = class
{
    constructor(id)
    {
        this.id = id;
    }
};

ajk.TargetProvider = class
{
    getTargets() { return []; }
};
ajk.TargetProviders = [];