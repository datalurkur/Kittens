ajk.operations.TradeOperation = class extends ajk.operations.Operation
{
    constructor(targetResource, race)
    {
        var deps = race.buys.concat([
            {name: 'gold',     val: 15},
            {name: 'manpower', val: 50},
        ]);
        super('trade', targetResource, deps);

        this.race = race;
    }
    execute(result)
    {
        var resultDemand = result;
        var resultAmount = 0;
        var tradeAmount = this._tradeAmount();
        while (true)
        {
            var required = Math.ceil(tradeAmount / resultDemand);
            var allowed = gamePage.diplomacy.getMaxTradeAmt(this.getRace(raceName)) || 0;
            var actual = Math.min(required, allowed);
            if (actual <= 0) { break; }

            var thisResult = this._tradeHack(actual);
            if (thisResult == null) { return null; }

            var resAmount = thisResult[this.target];
            resultDemand -= resAmount;
            resultAmount += resAmount;
        }
        return resultAmount;
    }
    _tradeHack(amount)
    {
        var diplo = gamePage.diplomacy;
        gamePage.resPool.addResEvent('manpower', -50 * amount);
        gamePage.resPool.addResEvent('gold',     -15 * amount);
        gamePage.resPool.addResEvent(this.race.buys[0].name, -this.race.buys[0].val * amount);

        var yieldResTotal = null;
        for (var i = 0; i < amount; ++i)
        {
            yieldResTotal = diplo.tradeInternal(this.race, true, yieldResTotal);
        }
        diplo.gainTradeRes(yieldResTotal, amt);

        return yieldResTotal;
    }
    _tradeAmount()
    {
        var saleData = this.race.sells.filter(s => s.name == this.target)[0];
        var season = gamePage.calendar.season;
        var seasonModifier;
             if (season == 1) { seasonModifier = saleData.seasons.spring; }
        else if (season == 2) { seasonModifier = saleData.seasons.summer; }
        else if (season == 3) { seasonModifier = saleData.seasons.autumn; }
        else                  { seasonModifier = saleData.seasons.winter; }

        var amount = saleData.value * (1 + gamePage.diplomacy.getTradeRatio());
        var chance = saleData.chance;

        if (this.race.name == 'zebras' && saleData.name == 'titanium')
        {
            // Special rules for this
            var numShips = gamePage.resPool.get('ship').value;
            amount = (0.03 * numShips) + 1.5;
            chance = ((0.35 * numShips) + 15) / 100;
        }

        return amount * (chance / 100) * seasonModifier; 
    }
};

ajk.operations.ExploreOperation = class extends ajk.operations.Operation
{
    constructor(race, dependencies)
    {
        super('explore', 'tradeRoute', dependencies);
    }
    execute(result)
    {
        // TODO
    }
};

ajk.Trade = class
{
    constructor()
    {

    }
    collectOperations(opManager)
    {
        if (!gamePage.diplomacyTab.visible) { return; }
        gamePage.diplomacy.races.forEach((race) => {
            if (race.unlocked)
            {
                // Add trade options
                race.sells.forEach((saleData) => {
                    opManager.addOperation(new TradeOperation(saleData.name, race));
                })
            }
            else
            {
                // Add exploration option
                var cost = this._explorationCost(race);
                if (cost != null)
                {
                    opManager.addOperation(new ExplorationOperation(race, cost.concat([
                    {
                        name: 'manpower',
                        val:  1000
                    }])));
                }
            }
        });
    }
    _explorationCost(race)
    {
        if (race.name == 'lizards' || race.name == 'griffins' || race.name == 'sharks')
        {
            var year = gamePage.calendar.year;
            if ((gamePage.prestige.getPerk('diplomacy').researched && year >=  1) ||
                (gamePage.resPool.get('karma').value > 0           && year >=  5) ||
                (                                                     year >= 20))
            {
                return [];
            }
        }
        else if (race.name == 'nagas')
        {
            return [{name: 'culture', val: 1500}];
        }
        else if (race.name == 'zebras')
        {
            return [{name: 'ship', val: 1}];
        }
        else if (race.name == 'spiders')
        {
            return [{name: 'ship', val: 100}, {name: 'maxScience', val: 125000}];
        }
        else if (race.name == 'dragons')
        {
            return [{name: 'nuclearFission', val: 1}];
        }
        else if (race.name == 'leviathans')
        {
            return [{name: 'blackPyramid', val: 1}];
        }
        return null;
    }
};