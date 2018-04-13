/*
    A target is any result of an operation, regardless of whether it is achieveable given the current game state
    This includes:
        Resource Production
        Resource Storage
        Resource Accumulation
        Structure Ownership (purchase / quantity met)
        Space Mission Completion
        Trade Route Discovery
        Transcendence Level
        Tab Unlocks
*/
ajk.Target = class
{
    constructor(id)
    {
        this.id = id;
    }
    deficit(quantity) { return quantity; }
};
ajk.ImpossibleTarget = class extends ajk.Target
{
    constructor() { super('impossible'); }
};

ajk.TargetProvider = class
{
    static getTargets() { return []; }
};
ajk.TargetProviders = [];