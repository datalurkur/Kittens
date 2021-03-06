'use strict';

ajk.analysisModule = {
    internal:
    {
        log: ajk.log.addChannel('analysis', true),

        preprocessors:  [],
        postprocessors: [],

        buildEmptyAnalysisData: function(itemMap, capLimits, purchaseDemand, powerThrottled)
        {
            var data = {
                eligible:                      Object.keys(itemMap),
                selected:                      [],
                resourceCapacityLimitations:   capLimits,
                purchaseDemand:                purchaseDemand,
                powerThrottled:                powerThrottled,
                resourceProductionLimitations: {},
                weights:                       {},
                priorityOrder:                 [],

                addModifier: function(itemName, modifier, modifierName)
                {
                    this.weights[itemName].weight += modifier;
                    this.weights[itemName].modifiers.push([modifierName, modifier]);
                },
            };
            return data;
        },
    },

    prepare: function(itemMap, capLimits, purchaseDemand, powerThrottled) { return this.internal.buildEmptyAnalysisData(itemMap, capLimits, purchaseDemand, powerThrottled); },
    preprocess: function(data, cache, itemMap)
    {
        this.internal.log.debug('Performing analysis preprocessing pass');
        this.internal.preprocessors.forEach((proc) => { proc(data, cache, itemMap, this.internal.log); });
    },
    prioritize: function(data)
    {
        data.priorityOrder = data.eligible;
        data.priorityOrder = data.priorityOrder.sort((a, b) => { return data.weights[b].weight - data.weights[a].weight; });
    },
    finalize: function(data)
    {
        data.priorityOrder = data.selected;
        data.priorityOrder = data.priorityOrder.sort((a, b) => { return data.weights[b].weight - data.weights[a].weight; });
    },
    postprocess: function(data, cache, itemMap)
    {
        this.internal.log.debug('Performing analysis postprocessing pass');
        this.internal.postprocessors.forEach((filter) => { filter(data, cache, itemMap, this.internal.log); });
    },
    addPreprocessor:  function(operation) { this.internal.preprocessors.push(operation);  },
    addPostprocessor: function(operation) { this.internal.postprocessors.push(operation); },
};

ajk.processors = { config: {} };

// Infinite time filtering
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    var meetsCriteria = [];
    data.eligible.forEach((itemName) => {
        if (itemMap[itemName].decisionTree.maxTime != Infinity)
        {
            meetsCriteria.push(itemName);
        }
    });
    data.eligible = meetsCriteria;
});

// Iron will mode
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    if (!ajk.config.ironWillMode) { return; }
    log.debug('Filtering by iron will limitations');
    log.indent();
    var meetsCriteria = [];
    data.eligible.forEach((itemName) => {
        if (Object.keys(itemMap[itemName].item.model.metadata.effects || {}).indexOf('maxKittens') == -1) { meetsCriteria.push(itemName); }
    });
    log.debug('Filtered out ' + (data.eligible.length - meetsCriteria.length) + ' items');
    log.unindent();
    data.eligible = meetsCriteria;
});

// Unmet max capacity filtering
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Filtering by resource capacity needs');
    log.indent();
    var meetsCriteria = [];
    data.eligible.forEach((itemName) => {
        var decisionTree = itemMap[itemName].decisionTree;
        if (decisionTree.capacityBlockers.length > 0)
        {
            log.debug('Excluding ' + itemName + ' because of lacking capacity');
            decisionTree.capacityBlockers.forEach((blocker) => {
                ajk.util.ensureKey(data.resourceCapacityLimitations, blocker[0], []).push([itemName, blocker[1]]);
            });
        }
        else
        {
            meetsCriteria.push(itemName);
        }
    });
    log.debug('Filtered out ' + (data.eligible.length - meetsCriteria.length) + ' items');
    log.unindent();
    data.eligible = meetsCriteria;
});

// Unmet production filtering
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Filtering by resource production needs');
    log.indent();
    var meetsCriteria = [];
    data.eligible.forEach((itemName) => {
        var consumption = cache.getResourceConsumptionForItem(itemName);
        var exclude = false;
        for (var resourceName in consumption)
        {
            if (cache.getResourceData(resourceName).perTick - consumption[resourceName] <= 0)
            {
                exclude = true;
                ajk.util.ensureKey(data.resourceProductionLimitations, resourceName, []).push([itemName, consumption[resourceName]]);
            }
        }
        if (!exclude)
        {
            meetsCriteria.push(itemName);
        }
    });
    log.debug('Filtered out ' + (data.eligible.length - meetsCriteria.length) + ' items');
    log.unindent();
    data.eligible = meetsCriteria;
});

// Default weights
ajk.processors.config.defaultWeights = {
    // Housing
    'hut': 1,
    'logHouse': 1,
    'mansion': 1,
    'spaceStation': 1,

    // Trading
    'tradeRouteDiscovery': 2,

    // Important sciences
    'theology': 2,

    // Important workshop upgrades
    'coalFurnace': 2,
    'deepMining': 2,
    'oxidation': 2,

    'ironwood': 3,
    'concreteHuts': 3,
    'unobtainiumHuts': 3,
    'eludiumHuts': 3,

    // Time related junk
    'skyPalace': 2,
    'ziggurat': 3,
    'unicornUtopia': 3,
    'sunspire': 4,
    'fluxCondensator': 5,
    'blackPyramid': 6
};
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Applying default weights');
    Object.keys(itemMap).forEach((itemName) => {
        data.weights[itemName] = {
            weight:    0,
            modifiers: []
        };
        if (ajk.processors.config.defaultWeights.hasOwnProperty(itemName))
        {
            data.addModifier(itemName, ajk.processors.config.defaultWeights[itemName], 'default weight');
        }
    });
});

// Happiness
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    if (!itemMap.hasOwnProperty('amphitheatre')) { return; }
    var mod = (2 - ajk.base.getHappiness()) * 3;
    data.addModifier('amphitheatre', mod, 'happiness');
});

// Type emphasis
ajk.processors.config.typeBonuses = {
    'science': 6,
    'missions': 5,
    'religion': 4,
    'workshop': 3
};
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Applying one-shot bonuses');
    Object.keys(itemMap).forEach((itemName) =>
    {
        if (ajk.processors.config.typeBonuses.hasOwnProperty(itemMap[itemName].type))
        {
            data.addModifier(itemName, ajk.processors.config.typeBonuses[itemMap[itemName].type], itemMap[itemName].type);
        }
    });
});

// Power demands
ajk.processors.config.powerBonus = 5;
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    if (!data.powerThrottled) { return; }
    log.debug('Applying power demand bonuses');
    cache.getItemsThatProduce('energy').forEach((itemName) => {
        if (itemMap.hasOwnProperty(itemName))
        {
            data.addModifier(itemName, ajk.processors.config.powerBonus, 'power demand');
        }
    });
});

// Time cost
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    var params = {
        max:        1,
        inflection: [6000,  -1],
        rolloff:    [18000, -4],
    }
    log.debug('Determining coefficients for cost adjustment functions');
    log.indent();
    log.debug('Using inflection point ' + params.inflection.join());
    log.debug('Using rolloff point ' + params.rolloff.join());
    log.debug('Maximum bonus ' + params.max);

    params.slope = (params.inflection[1] - params.max) / params.inflection[0];
    log.debug('Linear portion slope ' + params.slope);

    var t0 = -m*s + n + s*i - j;
    var t1 = m*n*s - m*s*j - n*s*i - s*i*j;

    if (t0 == 0 || t1 == 0)
    {
        log.warn('Parameters chosen for nonlinear portion have no solution');
        return;
    }

    params.solutionExists = true;

    var i = params.inflection[0];
    var j = params.inflection[1];
    var m = params.rolloff[0];
    var n = params.rolloff[1];
    var s = params.slope;

    var mMinusI = (m - i);
    var nMinusJ = (n - j);
    var aDenom = m*s - n - s*i + j;
    log.detail('Intermediates: ' + [i,j,m,n,s,mMinusI,nMinusJ,aDenom].join());

    params.a = -s*mMinusI*mMinusI*nMinusJ*nMinusJ / (aDenom * aDenom);
    params.b = (-m*n + m*s*i + m*j - s*i*i) / (-m*s + n + s*i - j);
    params.c = (-m*n*s + n*s*i + n*j - j*j) / (-m*s + n + s*i - j);
    log.debug('Params chosen: ' + [params.a,params.b,params.c].join());

    log.debug('Prices up to inflection point are scaled as ' + params.slope + '*x + ' + params.max);
    log.debug('Prices past the inflection point are scaled as ' + params.a + '*(x + ' + params.b + ')^(-1) + ' + params.c);

    Object.keys(itemMap).forEach((itemName) => {
        var costTime = itemMap[itemName].decisionTree.maxTime;
        var modifier = 0;
        if (costTime < params.inflection[0] || !params.solutionExists)
        {
            // Scale linearly
            log.detail('Scaling linearly');
            modifier = params.max + (costTime * params.slope);
        }
        else
        {
            // Scale non-linearly
            log.detail('Scaling non-linearly');
            modifier = (params.a / (params.b + costTime)) + params.c;
        }
        log.debug('Adjusting the weight of ' + itemName + ' by ' + modifier + ' to account for time-cost of ' + costTime);
        data.addModifier(itemName, modifier, 'time');
    });

    log.unindent();
});

// Purchase demand
ajk.analysisModule.addPostprocessor(function(data, cache, itemMap, log) {
    for (var demand in data.purchaseDemand)
    {
        if (!itemMap.hasOwnProperty(demand)) { continue; }
        var demander = data.purchaseDemand[demand];
        var modifier = Math.min(2, Math.exp(data.weights[demander].weight) * 0.05);
        data.addModifier(demand, modifier, demander);
    }
});

// Capacity providers
ajk.analysisModule.addPostprocessor(function(data, cache, itemMap, log) {
    for (var resource in data.resourceCapacityLimitations)
    {
        var highestWeight = data.resourceCapacityLimitations[resource].reduce((a, v) => {
            var itemWeight = data.weights[v[0]].weight || -Infinity;
            return Math.max(a, itemWeight);
        }, -Infinity);
        var modifier = Math.min(2, Math.exp(highestWeight) * 0.05);

        cache.getItemsThatStore(resource).forEach((itemName) => {
            data.addModifier(itemName, modifier, resource + ' storage');
        });
    }
});

// Containment Chamber Throttling
ajk.analysisModule.addPostprocessor(function(data, cache, itemMap, log) {
    var cc = ajk.base.getSpaceBuilding('containmentChamber');
    var antimatterData = cache.getResourceData('antimatter');
    var toAMCap = antimatterData.max - antimatterData.available;
    var sunlifters = ajk.base.getSpaceBuilding('sunlifter');

    if (cc.on < cc.val || sunlifters.val < toAMCap)
    {
        var index = data.eligible.indexOf('containmentChamber');
        if (index != -1)
        {
            data.eligible.splice(index, 1);
        }
    }
});

// AI Core Throttling
ajk.analysisModule.addPostprocessor(function(data, cache, itemMap, log) {
    log.debug('Throttling AI core purchasing');
    log.indent();

    var gflopProduction = ajk.base.getEffect('gflopsPerTickBase');
    var gflopConsumption = ajk.base.getEffect('gflopsConsumption');
    if (gflopProduction >= gflopConsumption)
    {
        var index = data.eligible.indexOf('aiCore');
        if (index != -1)
        {
            data.eligible.splice(index, 1);
        }
    }
    log.unindent();
});

// Competition
ajk.analysisModule.addPostprocessor(function(data, cache, itemMap, log) {
    log.debug('Filtering by resource competition');
    log.indent();
    var meetsCriteria = [];
    data.eligible.forEach((itemName) => {
        var treeA = itemMap[itemName].decisionTree;
        var inCompetition = false;
        for (var i = 0; i < meetsCriteria.length; ++i)
        {
            var treeB = itemMap[meetsCriteria[i]].decisionTree;
            if (ajk.decisionTreeFactory.areInCompetition(cache, treeA, treeB))
            {
                log.detail('Found ' + itemName + ' to be in competition with ' + meetsCriteria[i]);
                inCompetition = true;
                break;
            }
        }
        if (!inCompetition)
        {
            log.detail(itemName + ' has no resource competition');
            meetsCriteria.push(itemName);
        }
    });
    log.debug('Filtered out ' + (data.eligible.length - meetsCriteria.length) + ' items');
    log.unindent();
    data.selected = meetsCriteria;
});