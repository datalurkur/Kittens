'use strict';

ajk.operations = {
    log: ajk.log.addChannel('ops', false),

    // Represents an action that can be performed in order to satisfy a requirement / produce a resource / some other outcome
    Operation: class
    {
        constructor(method, target, dependencies)
        {
            this.log          = ajk.operations.log;
            this.method       = method;
            this.target       = target;
            this.dependencies = dependencies;
        }
        // Attempts to produce the specified amount of the target resource
        // Returns the number of resulting target resource on success, or null on failure
        execute(result)
        {
            this.log.warn('Operation has no execution method');
            return null;
        }
    },

    CraftOperation: class extends Operation
    {
        constructor(cache, craftName)
        {
            super.constructor('craft', craftName, ajk.base.getCraftCosts(craftName));
        }
        execute(result)
        {
            var required = Math.ceil(result / ajk.base.getCraftRatio());
            var allowed = ajk.base.getCraftAllAmount(this.craftName);
            var actual = Math.min(required, allowed);
            if (ajk.base.craft(this.craftName, actual))
            {
                return actual * ajk.base.getCraftRatio();
            }
            else
            {
                return null;
            }
        }
    },

    TradeOperation: class extends Operation
    {
        constructor(cache, targetResource, race, tradeAmount)
        {
            this.race        = race;
            this.tradeAmount = tradeAmount;

            var deps = {
                'gold':     15,
                'manpower': 50
            };
            race.buys.forEach(p => deps[p.name] = p.val);

            super.constructor('trade', targetResource, deps);
        }
        execute(result)
        {
            var resultDemand = result;
            var resultAmount = 0;
            while (true)
            {
                var required = Math.ceil(this.tradeAmount / resultDemand);
                var allowed = ajk.base.getTradeAllAmount(this.race.name);
                var actual = Math.min(required, allowed);
                if (actual <= 0) { break; }

                var thisResult = ajk.base.trade(this.race, actual);
                if (thisResult == null) { return null; }

                var resAmount = thisResult[this.targetResource];
                resultDemand -= resAmount;
                resultAmount += resAmount;
            }
            return resultAmount;
        }
    },

    ExploreOperation: class extends Operation
    {
        // TODO
    },

    SacrificeUnicornsOperation: class extends Operation
    {
        constructor(cache)
        {
            super.constructor('sacrifice', 'tears', {'unicorns': 2500});
        }
        execute(result)
        {
            var ratio = ajk.base.getBuilding('ziggurat').value;
            var required = result / ratio;
            var allowed = ajk.base.getResource('unicorns') / 2500;
            var actual = Math.min(required, allowed);
            var btn = ajk.base.religionTab.sacrificeBtn;
            return (btn.controller.sacrifice(btn.model, actual)) ? (actual * ratio) : null;
        }
    },

    SacrificeAlicornsOperation: class extends Operation
    {
        constructor(cache)
        {
            super.constructor('sacrifice', 'timeCrystal', {'alicorns': 25});
        }
        execute(result)
        {
            var allowed = ajk.base.getResource('alicorns') / 25;
            var actual = Math.min(result, allowed);
            var btn = ajk.base.religionTab.sacrificeAlicornBtn;
            return (btn.controller.sacrifice(btn.model, actual)) ? actual : null;
        }
    },

    PurchaseItemOperation: class extends Operation
    {
        constructor(cache, item)
        {
            this.item = item;

            var deps = {};
            item.model.prices.map(p => deps[p.name] = p.val);
            super.constructor('purchase', item.model.metadata.name, deps);
        }
        execute()
        {
            var success = false;
            this.item.controller.buyItem(item.model, {}, function(result) {
                success |= result;
            });
            return success ? 1 : null;
        }
    },
};