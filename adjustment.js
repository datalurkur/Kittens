'use strict';

ajk.adjustment = {
    // Reduce churn and reinforce whatever was chosen as top priority based on resource production prioritization
    reinforceTopPriority:
    {
        log: ajk.log.addChannel('adj-toppri', true),
        topModifier: -5,
        bottleneckModifier: -2,

        topPriority: null,
        bottlenecks: null,

        prepare: function()
        {
            this.topPriority = null;
            this.bottlenecks = null;

            this.log.debug('Prioritizing items based on the previous top priority');
            if (ajk.analysis.previousPriority.length > 0)
            {
                if (ajk.analysis.data.hasOwnProperty(ajk.analysis.previousPriority[0]))
                {
                    this.topPriority = ajk.analysis.previousPriority[0];
                    /*
                    // TOOD - Fix this
                    this.bottlenecks = ajk.resources.getBottlenecksFor(ajk.analysis.data[this.topPriority].costData);
                    this.log.debug('Production of ' + this.topPriority + ' is bottlenecked on ' + this.bottlenecks.length + ' resources');
                    */
                }
                else
                {
                    this.log.debug('Previous priority was met, skipping reinforcement');
                }
            }
        },
        modifyItem: function(itemKey)
        {
            if (this.topPriority == null) { return; }
            if (itemKey == this.topPriority)
            {
                this.log.debug('Increasing weight of ' + itemKey + ' to reinforce the previous top priority');
                ajk.analysis.modifyWeight(itemKey, this.topModifier, 'previous priority');
                return;
            }

            var currentMod = this.bottleneckModifier;
            for (var i = 0; i < this.bottlenecks.length; ++i)
            {
                if (ajk.cache.isProducerOf(this.bottlenecks[i].name))
                {
                    this.log.debug('Increasing weight of ' + itemKey + ' by ' + currentMod + ' based on production of a bottlenecked resource (' + this.bottlenecks[i].name + ')');
                }
                currentMod = currentMod / 2;
            }
        },
    },

    // Reward producers of in-demand resources
    weightedDemandScaling:
    {
        log: ajk.log.addChannel('adj-wdemand', true),
        modWeight: 0.5,

        weightedDemand: {},

        prepare: function()
        {
            this.log.debug('Prioritizing items based on weight-adjusted demand');
            // TODO - Fix this
            //this.weightedDemand = ajk.resources.getWeightedDemand(ajk.resources.previousDemand);
        },
        modifyItem: function(itemKey)
        {
            for (var resource in this.weightedDemand)
            {
                var mod = this.weightedDemand[resource] * this.modWeight;

                // Catnip production really shouldn't drive weights too heavily
                if (resource == 'catnip') { mod = mod * 0.1; }

                if (ajk.cache.isProducerOf(itemKey, resource))
                {
                    this.log.debug('Increasing weight of ' + itemKey + ' by ' + mod + ' based on the demand for ' + resource);
                    ajk.analysis.modifyWeight(itemKey, mod, 'production of ' + resource);
                }
                else if (ajk.cache.isConsumerOf(itemKey, resource))
                {
                    this.log.debug('Decreasing weight of ' + itemKey + ' by ' + mod + ' based on the demand for ' + resource);
                    ajk.analysis.modifyWeight(itemKey, -mod, 'consumption of ' + resource);
                }
            }
        }
    },

    // Reward anything that unlocks a new tab (eventually)
    tabDiscovery:
    {
        log: ajk.log.addChannel('adj-tabdisc', true),
        priorityWeight: -5,

        priorityList: [],

        prepare: function()
        {
            if (!ajk.core.scienceTab.visible)
            {
                this.priorityList = ['library'];
            }
            else if (!ajk.core.workshopTab.visible)
            {
                this.priorityList = [
                    'calendar',
                    'agriculture',
                    'mining',
                    'workshop'
                ];
            }
            else if (!ajk.core.religionTab.visible)
            {
                this.priorityList = [
                    'archery',
                    'animal',
                    'construction',
                    'engineering',
                    'writing',
                    'philosophy',
                    'theology',
                    'temple'
                ];
            }
            else if (!ajk.core.spaceTab.visible)
            {
                this.priorityList = [
                    'theology',
                    'astronomy',
                    'navigation',
                    'physics',
                    'electricity',
                    'industrialization',
                    'mechanization',
                    'electronics',
                    'rocketry'
                ];
            }
            else
            {
                this.priorityList = [];
            }
        },
        modifyItem: function(itemKey)
        {
            for (var i = 0; i < this.priorityList.length; ++i)
            {
                if (itemKey == this.priorityList[i])
                {
                    this.log.debug('Priotizing ' + itemKey + ' in order to discover a new tab');
                    ajk.analysis.modifyWeight(itemKey, this.priorityWeight, 'tab discovery');
                }
            }
        }
    },

    // Penalize trading for resources slightly, but reward trade benefit producers if a lot of trade is in demand (read: titanium)
    tradingModule:
    {
        log: ajk.log.addChannel('adj-trading', true),
        tradePenalty: 1,
        tradeProductionBonusBase: -2,

        tradeBottleneckRatio: 0,
        tradeProductionBonus: 0,

        // TODO - Fix this
        hasTradeBottleneck: function(costData)
        {
            var mostExpensive = 0;
            for (var i = 1; i < costData.prices.length; ++i)
            {
                if (costData.prices[i].time > costData.prices[mostExpensive])
                {
                    mostExpensive = i;
                }
            }
            var exp = costData.prices[mostExpensive];
            if (exp.method == 'Trade') { return true; }
            else if (exp.hasOwnProperty('dependencies'))
            {
                return this.hasTradeBottleneck(exp.dependencies);
            }
            else
            {
                return false;
            }
        },
        prepare: function()
        {
            var pp = ajk.analysis.previousOrder;
            if (pp.length == 0)
            {
                this.tradeBottleneckRatio = 0;
                this.tradeProductionBonus = 0;
                return;
            }

            var numTradeBottlenecks = 0;
            for (var i = 0; i < pp.length; ++i)
            {
                var ppData = ajk.analysis.data[pp[i]];
                if (ppData == undefined)
                {
                    continue;
                }
                // TODO - Fix this
                if (this.hasTradeBottleneck(ajk.analysis.data[pp[i]].costData))
                {
                    numTradeBottlenecks += 1;
                }
            }
            this.log.debug('Found ' + numTradeBottlenecks + ' / ' + pp.length + ' items are bottlenecked on trading');
            this.tradeBottleneckRatio = (numTradeBottlenecks / pp.length);
            this.tradeProductionBonus = this.tradeBottleneckRatio * this.tradeProductionBonusBase;
        },
        modifyItem: function(itemKey)
        {
            // TODO - Fix this
            var costData = ajk.analysis.data[itemKey].costData;

            // Apply an across-the board penalty for any item that it primarily bottlenecked by a resource that is being traded for
            if (this.hasTradeBottleneck(costData))
            {
                this.log.detail('Penalizing ' + itemKey + ' because it uses trading to fulfill its resource costs');
                ajk.analysis.modifyWeight(itemKey, this.tradePenalty, 'uses trading');
            }
            else if (ajk.cache.isProducerOf(itemKey, 'trade'))
            {
                this.log.detail('Prioritizing ' + itemKey + ' because it provides trade bonuses');
                ajk.analysis.modifyWeight(itemKey, this.tradeProductionBonus, 'boosts trade');
            }
        }
    },

    // Move more expensive items down the list
    priceRatioModule:
    {
        log: ajk.log.addChannel('adj-price', true),
        params:
        {
            min: -1,
            inflection: [9000, 2],
            rolloff: [18000, 4],

            slope: 1,
            solutionExists: false,

            a: 0,
            b: 0,
            c: 0,
        },
        prepare: function()
        {
            this.log.debug('Determining coefficients for cost adjustment functions');
            this.log.indent();
            this.log.debug('Using inflection point ' + this.params.inflection.join());
            this.log.debug('Using rolloff point ' + this.params.rolloff.join());
            this.log.debug('Minimum value ' + this.params.min);

            this.params.slope = (this.params.inflection[1] - this.params.min) / this.params.inflection[0];
            this.log.debug('Linear portion slope ' + this.params.slope);

            var t0 = -m*s + n + s*i - j;
            var t1 = m*n*s - m*s*j - n*s*i - s*i*j;

            if (t0 == 0 || t1 == 0)
            {
                this.log.warn('Parameters chosen for nonlinear portion have no solution');
                return;
            }

            this.params.solutionExists = true;

            var i = this.params.inflection[0];
            var j = this.params.inflection[1];
            var m = this.params.rolloff[0];
            var n = this.params.rolloff[1];
            var s = this.params.slope;

            var mMinusI = (m - i);
            var nMinusJ = (n - j);
            var aDenom = m*s - n - s*i + j;
            this.log.detail('Intermediates: ' + [i,j,m,n,s,mMinusI,nMinusJ,aDenom].join());

            this.params.a = -s*mMinusI*mMinusI*nMinusJ*nMinusJ / (aDenom * aDenom);
            this.params.b = (-m*n + m*s*i + m*j - s*i*i) / (-m*s + n + s*i - j);
            this.params.c = (-m*n*s + n*s*i + n*j - j*j) / (-m*s + n + s*i - j);
            this.log.debug('Params chosen: ' + [this.params.a,this.params.b,this.params.c].join());

            this.log.debug('Prices up to inflection point are scaled as ' + this.params.slope + '*x + ' + this.params.min);
            this.log.debug('Prices past the inflection point are scaled as ' + this.params.a + '*(x + ' + this.params.b + ')^(-1) + ' + this.params.c);
            this.log.unindent();
        },
        evaluate: function(costTime)
        {
            if (costTime < this.params.inflection[0] || !this.params.solutionExists)
            {
                // Scale linearly
                this.log.detail('Scaling linearly');
                return this.params.min + (costTime * this.params.slope);
            }
            else
            {
                // Scale non-linearly
                this.log.detail('Scaling non-linearly');
                return (this.params.a / (this.params.b + costTime)) + this.params.c;
            }
        },
        modifyItem: function(itemKey)
        {
            var costTime = ajk.analysis.data[itemKey].costData.time;
            var modifier = this.evaluate(costTime);
            this.log.debug('Adjusting the weight of ' + itemKey + ' by ' + modifier + ' to account for time-cost of ' + costTime);
            ajk.analysis.modifyWeight(itemKey, modifier, 'time');

        },
    },

    // If an item was prioritized heavily but lacked capacity, attempt to unblock it
    capacityUnblocking:
    {
        log: ajk.log.addChannel('adj-capacity', true),
        priorityExtent: 5,
        priorityFalloff: 0.3,
        priorityReward: -3,

        rewardMap: {},

        prepare: function()
        {
            this.log.debug('Creating bounties for items blocked by missing resource capacity');
            this.log.indent();

            this.rewardMap = {};
            var currentReward = this.priorityReward;
            for (var i = 0; i < this.priorityExtent && i < ajk.analysis.previousOrder.length; ++i)
            {
                var p = ajk.analysis.previousOrder[i];
                var data = ajk.analysis.data[p];
                if (data == undefined) { continue; }
                if (data.missingMaxResources)
                {
                    for (var j = 0; j < data.costData.prices.length; ++j)
                    {
                        var price = data.costData.prices[j];
                        var resource = ajk.base.getResource(price.name);
                        if (ajk.resources.available(price.name) && resource.maxValue != 0 && resource.maxValue < price.val && !this.rewardMap.hasOwnProperty(price.name))
                        {
                            this.log.debug('Creating bounty for any storers of ' + price.name + ' for ' + p);
                            this.rewardMap[price.name] = currentReward;
                        }
                    }
                }
                currentReward *= this.priorityFalloff;
            }

            this.log.unindent();
        },
        modifyItem: function(itemKey)
        {
            var maxReward = 0;
            var maxResource = null;
            for (var rewardResource in this.rewardMap)
            {
                var bounty = this.rewardMap[rewardResource];
                if (ajk.cache.isStorerOf(itemKey, rewardResource) && maxReward > bounty)
                {
                    this.log.detail(itemKey + ' stores ' + rewardResource + '; potentially claiming bounty of ' + bounty);
                    maxReward = bounty;
                    maxResource = rewardResource;
                }
            }
            if (maxReward != 0)
            {
                this.log.debug('Prioritizing ' + itemKey + ' because it stores ' + maxResource);
                ajk.analysis.modifyWeight(itemKey, maxReward, 'Storage of ' + maxResource);
            }
        }
    }
};
