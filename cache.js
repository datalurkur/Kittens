'use strict';

ajk.cache = {
    internal:
    {
        log: ajk.log.addChannel('cache', true),

        // Definitions and constants
        effectTypes:
        [
            {
                type: 'production',
                postfixes: [
                    'PerTickAutoprod',
                    'PerTickBase',
                    'PerTickProd',
                    'Production',
                    'DemandRatio',
                    'RatioGlobal',
                    'Ratio',
                ],
            },
            {
                type: 'consumption',
                postfixes:
                [
                    'PerTickConsumption',
                    'PerTickCon',
                    'PerTick',
                    'Consumption',
                ],
            },
            {
                type: 'storage',
                postfixes: [
                    'Max',
                ],
            },
        ],

        bufferConfig:
        {
            'catnip': [5000, 0.1]
        },

        productionOutput:
        {
            'energy': function() { return ajk.base.getEnergyDelta(); },
        },

        explorationOrder:
        {
            'griffins':   0,
            'lizards':    0,
            'sharks':     0,
            'nagas':      1,
            'zebras':     2,
            'spiders':    3,
            'dragons':    4,
            'leviathans': 5,
        },

        // Cached data
        effectCache:   {},
        resourceCache: {},

        huntingCache:
        {
            allowHunting:    false,
            avgHuntsPerTick: 0,
            expectedPerTick: {},
        },

        tradeCache:
        {
            traders:               {},
            resources:             {},
            exploration:           {},
            nextExplorationTarget: null,
        },

        resourceUnlocked: function(resourceName)
        {
            if (this.resourceCache.hasOwnProperty(resourceName)) { return this.resourceCache[resourceName].unlocked; }

            var baseResource = ajk.base.getResource(resourceName);
            if (baseResource.unlocked) { return true; }
            if (baseResource.craftable)
            {
                var craft = ajk.base.getCraft(resourceName);
                for (var i = 0; i < craft.prices.length; ++i)
                {
                    if (!this.resourceUnlocked(craft.prices[i].name)) { return false; }
                }
                return true;
            }
            if (this.tradeCache.resources.hasOwnProperty(resourceName))
            {
                return true;
            }
            return false;
        },

        getNetProductionOf: function(resource)
        {
            if (this.productionOutput.hasOwnProperty(resource))
            {
                return this.productionOutput[resource]();
            }
            return ajk.base.getProductionOf(resource) + ajk.base.getConsumptionOf(resource);
        },

        getBufferFor: function(resource)
        {
            if (!this.bufferConfig.hasOwnProperty(resource)) { return 0; }
            var bufferData = this.bufferConfig[resource];
            var scaledBuffer = ajk.base.getResource(resource).maxValue * bufferData[1];
            return Math.max(scaledBuffer, bufferData[0]);
        },

        matchEffect: function(item, effect, typeIndex)
        {
            var table = this.effectCache[this.effectTypes[typeIndex].type];
            for (var i = 0; i < this.effectTypes[typeIndex].postfixes.length; ++i)
            {
                var index = effect.indexOf(this.effectTypes[typeIndex].postfixes[i]);
                if (index != -1)
                {
                    var resource = effect.substring(0, index);

                    // Update effect map
                    table.effectMap[effect] = resource;

                    // Update item map
                    if (!table.itemMap.hasOwnProperty(resource))
                    {
                        table.itemMap[resource] = [];
                    }
                    table.itemMap[resource].push(item);

                    // Update resource map
                    if (!table.resourceMap.hasOwnProperty(resource))
                    {
                        table.resourceMap[resource] = [];
                    }
                    var found = false;
                    for (var i = 0; i < table.resourceMap[resource].length; ++i)
                    {
                        if (table.resourceMap[resource][i] == effect)
                        {
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                    {
                        table.resourceMap[resource].push(effect);
                    }

                    return true;
                }
            }
            return false;
        },

        cacheEffectsFor: function(itemList)
        {
            this.log.debug('Caching effects for ' + itemList.length + ' items');
            this.log.indent();

            for (var i = 0; i < itemList.length; ++i)
            {
                var itemData = itemList[i].model.metadata;
                if (typeof itemData === 'undefined')
                {
                    this.log.trace('No metadata present for ' + itemList[i].model.name);
                    continue;
                }
                this.log.trace('Caching effects for ' + itemData.name);
                var effects = itemData.effects;
                if (itemData.hasOwnProperty('stage'))
                {
                    effects = itemData.stages[itemData.stage].effects;
                }
                for (var effectName in effects)
                {
                    if (effects[effectName] == 0)
                    {
                        this.log.detail('Ignoring effect ' + effectName + ' with zero-value for ' + itemData.name);
                        continue;
                    }
                    for (var j = 0; j < this.effectTypes.length; ++j)
                    {
                        if (this.matchEffect(itemData.name, effectName, j)) { break; }
                    }
                }
            }

            this.log.unindent();
        },

        getTradeAmountFor: function(race, saleData)
        {
            var season = ajk.base.getSeason();
            var seasonModifier;
                 if (season == 1) { seasonModifier = saleData.seasons.spring; }
            else if (season == 2) { seasonModifier = saleData.seasons.summer; }
            else if (season == 3) { seasonModifier = saleData.seasons.autumn; }
            else                  { seasonModifier = saleData.seasons.winter; }

            var amount = saleData.value * ajk.base.getTradeRatio();
            var chance = saleData.chance;

            if (race.name == 'zebras' && resourceName == 'titanium')
            {
                // Special rules for this
                var numShips = ajk.base.getResource('ship').value;
                amount = (0.03 * numShips) + 1.5;
                chance = ((0.35 * numShips) + 15) / 100;
            }

            return amount * (chance / 100) * seasonModifier;
        },

        getExplorationRequirementsFor(race)
        {
            // There's a bug here where if we don't build anything for a while, we could wait longer than necessary to explore for lizards, griffins, sharks, and nagas.
            // Do we care? Naaaaah.
            if (race.name == 'lizards' || race.name == 'griffins' || race.name == 'sharks')
            {
                var available = (
                    (ajk.base.getPerk('diplomacy').researched && ajk.base.getYear() >=  1) ||
                    (ajk.base.getResource('karma').value > 0  && ajk.base.getYear() >=  5) ||
                    (                                            ajk.base.getYear() >= 20)
                );
                return available ? null : {};
            }
            else if (race.name == 'nagas')
            {
                var culture = ajk.base.getResource('culture');
                if (culture.maxValue < 1500)
                {
                    return {'storage': 'culture'};
                }
                else if (culture.value < 1500)
                {
                    return {'production': 'culture'};
                }
                else
                {
                    return null;
                }
            }
            else if (race.name == 'zebras')
            {
                return (ajk.base.getResource('ship').value == 0) ? {'purchase': 'tradeShip_custom'} : null;
            }
            else if (race.name == 'spiders')
            {
                if (ajk.base.getResource('ship').value < 100)
                {
                    return {'purchase': 'tradeShip_custom'};
                }
                else if (ajk.base.getResource('science').maxValue < 125000)
                {
                    return {'storage' : 'science'};
                }
                else
                {
                    return null;
                }
            }
            else if (race.name == 'dragons')
            {
                return (ajk.base.getScience('nuclearFission').researched) ? null : {'purchase': 'nuclearFission'};
            }
            else if (race.name == 'leviathans')
            {
                return (ajk.base.getZigguratUpgrade('blackPyramid').val == 0) ? {'construct': 'blackPyramid'} : {};
            }
        },

        cacheTradeData: function()
        {
            this.tradeCache = {
                traders:               {},
                resources:             {},
                exploration:           {},
                nextExplorationTarget: null
            };

            var allRaces = ajk.base.getAllRaces();
            for (var i = 0; i < allRaces.length; ++i)
            {
                var race = allRaces[i];
                if (!race.unlocked) { continue; }

                this.log.detail('Adding trade amounts for ' + race.name);
                var saleData = {};
                for (var j = 0; j < race.sells.length; ++j)
                {
                    var resourceName = race.sells[j].name;
                    var tradeAmount = this.getTradeAmountFor(race, race.sells[j]);
                    saleData[resourceName] = tradeAmount;
                    if (!this.tradeCache.resources.hasOwnProperty(resourceName))
                    {
                        this.tradeCache.resources[resourceName] = [];
                    }
                    this.tradeCache.resources[resourceName].push({
                        race: race,
                        tradeAmount: tradeAmount
                    });
                }
                this.tradeCache.traders[race.name] = {
                    sells: saleData,
                    race:  race,
                };
            }
        },

        cacheExplorationData: function()
        {
            var allRaces = ajk.base.getAllRaces();
            for (var i = 0; i < allRaces.length; ++i)
            {
                var race = allRaces[i];
                if (!race.unlocked)
                {
                    this.log.detail('Adding exploration requirements for ' + race.name);
                    this.tradeCache.exploration[race.name] = this.getExplorationRequirementsFor(race);
                }
            }

            var earliestRace = Infinity;
            for (var raceName in this.tradeCache.exploration)
            {
                if (this.explorationOrder[raceName] < earliestRace)
                {
                    this.tradeCache.nextExplorationTarget = raceName;
                }
            }
        },
    },

    rebuild: function(resources, allItems)
    {
        this.internal.log.debug('Rebuilding cache');
        this.internal.log.indent();

        // Cache trade data
        this.internal.cacheTradeData();

        // Rebuild resource cache
        this.internal.resourceCache = {};
        for (var i = 0; i < resources.length; ++i)
        {
            var res = resources[i];
            this.internal.log.detail('Caching data for resource ' + res.name);
            var buffer = this.internal.getBufferFor(res.name);
            var bufferNeeded = buffer - res.value;
            var available = res.value;
            if (bufferNeeded < 0 && buffer > 0)
            {
                this.internal.log.detail('Reserving a buffer of ' + buffer + ' ' + res.name);
                bufferNeeded = 0;
                available -= buffer;
            }
            else if (buffer > 0)
            {
                this.internal.log.detail('Current quantity of ' + res.name + ' does not satisfy buffer requirements');
            }
            this.internal.resourceCache[res.name] = {
                unlocked:  this.internal.resourceUnlocked(res.name),
                perTick:   this.internal.getNetProductionOf(res.name),
                buffer:    bufferNeeded,
                available: Math.max(0, res.value - buffer),
            };
        }

        // Rebuild hunting data
        this.internal.log.detail('Caching hunting data and expected spoils');
        // TODO - Solve the problem of other catpower consumers interfering with this metric
        this.internal.huntingCache.allowHunting = ajk.base.getJob('hunter').unlocked;
        this.internal.huntingCache.expectedPerTick = {};
        var avgHuntsPerTick = this.internal.resourceCache['manpower'].perTick / 100;
        var hunterRatio = ajk.base.getHunterRatio();

        var expectedFursPerHunt = 39.5 + ((65 * (hunterRatio - 1)) / 2);
        this.internal.huntingCache.expectedPerTick['furs'] = expectedFursPerHunt * avgHuntsPerTick;

        var ivoryChance = (44 + (2 * hunterRatio)) / 100;
        var ivoryAmount = 24.5 + ((40 * (hunterRatio - 1)) / 2);
        this.internal.huntingCache.expectedPerTick['ivory'] = ivoryChance * ivoryAmount * avgHuntsPerTick;

        this.internal.huntingCache.avgHuntsPerTick = avgHuntsPerTick;

        // Update per-tick data based on the hunting cache
        if (this.internal.huntingCache.allowHunting)
        {
            for (var resource in this.internal.huntingCache.expectedPerTick)
            {
                this.internal.resourceCache[resource].perTick += this.internal.huntingCache.expectedPerTick[resource];
            }
        }

        // Rebuild effect cache
        this.internal.effectCache = {};
        for (var i = 0; i < this.internal.effectTypes.length; ++i)
        {
            this.internal.effectCache[this.internal.effectTypes[i].type] = {
                effectMap:   {},
                resourceMap: {},
                itemMap:     {}
            };
        }

        // Take the item groupings and cache their effects
        this.internal.log.detail('Rebuilding effect cache for ' + allItems.length + ' item groups');
        for (var i = 0; i < allItems.length; ++i)
        {
            this.internal.cacheEffectsFor(allItems[i]);
        }

        // Cache exploration data
        this.internal.cacheExplorationData();

        this.internal.log.unindent();
    },

    getTradeDataForResource: function(resourceName)
    {
        return this.internal.tradeCache.resources[resourceName] || [];
    },

    getAvailableQuantityOfResource: function(resourceName)
    {
        return this.internal.resourceCache[resourceName].available;
    },

    getCurrentProductionOfResource: function(resourceName)
    {
        return this.internal.resourceCache[resourceName].perTick;
    }

    // TODO - Add accessors for various bits of data
};