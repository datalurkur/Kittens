'use strict';

ajk.analysisModule = {
    internal:
    {
        log: ajk.log.addChannel('analysis', true),

        preprocessors:  [],
        postprocessors: [],

        buildEmptyAnalysisData: function(itemMap)
        {
            var data = {
                eligible:                      Object.keys(itemMap),
                resourceCapacityLimitations:   {},
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

    prepare: function(itemMap) { return this.internal.buildEmptyAnalysisData(itemMap); },
    preprocess: function(data, cache, itemMap)
    {
        this.internal.log.debug('Performing analysis preprocessing pass');
        this.internal.preprocessors.forEach((proc) => { proc(data, cache, itemMap, this.internal.log); });
    },
    prioritize: function(data)
    {
        data.priorityOrder = data.eligible;
        data.priorityOrder = data.priorityOrder.sort(function(a, b) { return data.weights[b] - data.weights[a]; });
    },
    postprocess: function(data, cache, itemMap)
    {
        this.internal.log.debug('Performing analysis postprocessing pass');
        this.internal.postprocessors.forEach((filter) => { filter(data, cache, itemMap, this.internal.log); });
    },
    addPreprocessor:  function(operation) { this.internal.preprocessors.push(operation);      },
    addPostprocessor: function(operation) { this.internal.postprocessors.push(operation);  },
};

ajk.processors = { config: {} };

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
                if (!data.resourceCapacityLimitations.hasOwnProperty(blocker[0]))
                {
                    data.resourceCapacityLimitations[blocker[0]] = [];
                }
                data.resourceCapacityLimitations[blocker[0]].push(blocker[1]);
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

// Unmet max capacity filtering
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Filtering by resource production needs');
    log.indent();
    var meetsCriteria = [];
    data.eligible.forEach((itemName) => {
        var consumption = cache.getResourceConsumptionForItem(itemName);
        var exclude = false;
        for (var resourceName in consumption)
        {
            if (cache.getCurrentProductionOfResource(resourceName) + consumption[resourceName] <= 0)
            {
                exclude = true;
                if (!data.resourceProductionLimitations.hasOwnProperty(resourceName))
                {
                    data.resourceProductionLimitations[resourceName] = [];
                }
                data.resourceProductionLimitations[resourceName].push(consumption[resourceName]);
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
    // TODO
};
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Applying default weights');
    data.eligible.forEach((itemName) => {
        data.weights[itemName] = {
            weight:    ajk.processors.config.defaultWeights[itemName] || 0,
            modifiers: []
        };
    });
});

// One-shots
ajk.processors.config.oneShotWeightBonus = 5;
ajk.analysisModule.addPreprocessor(function(data, cache, itemMap, log) {
    log.debug('Applying one-shot bonuses');
    data.eligible.forEach((itemName) => { data.addModifier(itemName, ajk.processors.config.oneShotWeightBonus, 'one-shot'); });
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
    data.eligible = meetsCriteria;
});