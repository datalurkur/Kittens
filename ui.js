'use strict';

ajk.ui = {
    log: ajk.log.addChannel('ui', true),

    resourceInfo:
    {
        'antimatter':
        {
            'color': 'grey',
            'on': false,
        },
        'void':
        {
            'color': 'black',
            'on': false,
        },
        'catnip':
        {
            'color': 'limeGreen',
            'on'   : false,
        },
        'uranium':
        {
            'color': 'lime',
            'on'   : true,
        },
        'thorium':
        {
            'color': 'chartreuse',
            'on'   : false,
        },
        'spice':
        {
            'color': 'teal',
            'on'   : false,
        },
        'science':
        {
            'color': 'cornflowerblue',
            'on'   : true,
        },
        'culture':
        {
            'color': 'blueviolet',
            'on'   : true,
        },
        'oil':
        {
            'color': 'lightblue',
            'on'   : true,
        },
        'unobtainium':
        {
            'color': 'dodgerblue',
            'on'   : true,
        },
        'iron':
        {
            'color': 'skyblue',
            'on'   : true,
        },
        'steel':
        {
            'color': 'royalblue',
            'on'   : true,
        },
        'wood':
        {
            'color': 'peru',
            'on'   : true,
        },
        'manpower':
        {
            'color': 'orangered',
            'on'   : true,
            'alternateName': 'catpower',
        },
        'furs':
        {
            'color': 'crimson',
            'on'   : false,
        },
        'manuscript':
        {
            'color': 'lightpink',
            'on'   : true,
        },
        'titanium':
        {
            'color': 'gainsboro',
            'on'   : true,
        },
        'minerals':
        {
            'color': 'silver',
            'on'   : true,
        },
        'coal':
        {
            'color': 'lightslategray',
            'on'   : true,
        },
        'eludium':
        {
            'color': 'darkviolet',
            'on'   : true,
        },
        'faith':
        {
            'color': 'slateBlue',
            'on'   : true,
        },
        'alicorn':
        {
            'color': 'violet',
            'on'   : false,
        },
        'gold':
        {
            'color': 'orange',
            'on'   : true,
        },
        'ivory':
        {
            'color': 'cornsilk',
            'on'   : false,
        },
        'unicorns':
        {
            'color': 'azure',
            'on'   : true,
        },
        'starchart':
        {
            'color': 'beige',
            'on'   : true,
        },
        'energy':
        {
            'color': 'yellow',
            'on'   : false,
        },
    },

    eventChannels:
    [
        {
            name:         'minor-0',
            color:        'white',
            on:           false,
        },
        {
            name:         'minor-1',
            color:        'white',
            on:           false,
        },
        {
            name:         'minor-2',
            color:        'white',
            on:           true,
        },
        {
            name:         'standard-3',
            color:        'steelblue',
            on:           true,
        },
        {
            name:         'standard-4',
            color:        'steelblue',
            on:           true,
        },
        {
            name:         'major-5',
            color:        'crimson',
            on:           true,
        },
    ],

    graphOptions:
    {
        interpolation: 'step-after',
        interpolationOptions: ['monotone', 'cardinal', 'step-after', 'linear'],
        leftPadding: 64,
        rightPadding: 128,
    },

    panelState: {},

    modalDialogOpen: false,
    cachedGraphData: [],
    resizeListener:  null,

    itemDataCache:   null,
    analysisCache:   null,
    decisionDetail:  null,

    graphManip:
    {
        zoomSpeed:   0.001,
        leftTrim:    0,
        rightTrim:   0,
        minTrimSize: 0.1,
    },

    // Callbacks
    togglePanel: function(panelHeader)
    {
        var panel = $(panelHeader).next()[0];
        var collapsed = (panel.style.display == 'none');
        panel.style.display = (collapsed ? 'block' : 'none');
        this.panelState[panel.id] = !collapsed;
    },

    switchToTab: function(tabDescriptor)
    {
        $('.ajkTab').css('display', 'none');
        $(tabDescriptor).css('display', 'block');
    },

    toggleModalDialog: function(visible)
    {
        this.modalDialogOpen = visible;

        $('#ajkModalWindow').css('display', visible ? 'block' : 'none');

        if (visible)
        {
            this.updateGraphData();
            this.buildGraphs();
            this.refreshAnalysisUI();
        }
    },

    toggleGraphResource: function(resource)
    {
        this.resourceInfo[resource].on = !this.resourceInfo[resource].on;
        this.updateGraphData();
        this.buildGraphs();
    },

    toggleEventChannel: function(channelData)
    {
        channelData.on = !channelData.on;
        this.updateGraphData();
        this.buildGraphs();
    },

    setDecisionDetail: function(itemName)
    {
        this.decisionDetail = itemName;
        this.buildDecisionTreeGraph();
    },

    convertTicksToTimeString: function(ticks)
    {
        if (ticks == 0) { return 'now'; }
        if (ticks == Infinity) { return 'forever'; }
        var timeLeft = Math.ceil(ticks / 5);
        var timeString = '';

        var seconds = Math.floor(timeLeft % 60);
        timeLeft = Math.floor(timeLeft / 60);
        timeString += ('0' + seconds).slice(-2) + 's';

        if (timeLeft > 0)
        {
            var minutes = Math.floor(timeLeft % 60);
            timeLeft = Math.floor(timeLeft / 60);
            timeString = ('0' + minutes).slice(-2) + 'm ' + timeString;

            if (timeLeft > 0)
            {
                var hours = Math.floor(timeLeft % 24);
                timeLeft = Math.floor(timeLeft / 24);
                timeString = ('0' + hours).slice(-2) + 'h ' + timeString;

                if (timeLeft > 0)
                {
                    var days = Math.floor(timeLeft);
                    timeString = ('0' + days).slice(-2) + 'd ' + timeString;
                }
            }
        }

        return timeString;
    },

    createLogChannelToggles: function()
    {
        $('#enableAllChannelsButton').click(function() { ajk.log.toggleAllChannels(true); ajk.ui.createLogChannelToggles(); })
        $('#disableAllChannelsButton').click(function() { ajk.log.toggleAllChannels(false); ajk.ui.createLogChannelToggles(); })

        var channelContainer = $('#logChannelContainer');
        channelContainer.empty();

        // We use this weird pattern here by intention
        // Using foreach ensures that every event listener closure gets its own immutable value for channel, rather than all of the channels just being equal to the last channel in the loop
        Object.keys(ajk.log.internal.channels).forEach((channel) => {
            var toggleName = 'logChannel' + channel + 'Toggle';

            var input = document.createElement('input');
            input.id = toggleName;
            input.type = 'checkbox';
            input.checked = ajk.log.internal.channelActive(channel);
            input.addEventListener('click', () => { ajk.log.toggleChannel(channel) });
            channelContainer.append(input);

            var label = document.createElement('label');
            label.htmlFor = toggleName;
            label.innerHTML = channel;
            channelContainer.append(label);

            var lineBreak = document.createElement('br');
            channelContainer.append(lineBreak);
        });
    },

    updateGraphData: function()
    {
        var data = ajk.statistics.get();

        // Event significance toggles
        var eventToggles = d3.select('.toggleContainer #events').selectAll('div').data(this.eventChannels);
        eventToggles.exit().remove();
        var newEventToggles = eventToggles.enter().append('div');

        newEventToggles.append('input')
            .attr('type', 'checkbox')
            .attr('id', d => d.name)
            .on('click', d => this.toggleEventChannel(d));
        newEventToggles.append('label')
            .attr('for', d => d.name)
            .style('color', d => d.color)
            .text(d => d.name);

        eventToggles.selectAll('div input')
            .property('checked', d => d.on);

        // Resource toggles
        var resourceToggles = d3.select('.toggleContainer #resources').selectAll('div').data(data.allResources);
        resourceToggles.exit().remove();
        var newResourceToggles = resourceToggles.enter().append('div');

        newResourceToggles.append('input')
            .attr('type', 'checkbox')
            .attr('id', d => d)
            .on('click', d => this.toggleGraphResource(d));
        newResourceToggles.append('label')
            .attr('for', d => d)
            .style('color', d => this.resourceInfo[d].color)
            .text(d => this.resourceInfo[d].alternateName || d);

        resourceToggles.selectAll('div input')
            .property('checked', d => this.resourceInfo[d].on);

        // Per tick graph
        var perTickData = {
            title:         'net resources / second',
            padding:        [this.graphOptions.leftPadding, this.graphOptions.rightPadding, 32, 32],
            baseTimeDomain: data.timeDomain,
            xTicks:         7,
            type:           'lineGraph',
            parent:         'perTickGraph',

            // LineGraph Specific
            yTicks:         9,
            interpolation:  this.graphOptions.interpolation,
            yTickFormat:    function(d) { return d3.format('.2s')(d * 5) + ' / s'; },

            // Computed
            yDomain:        [0, 0],
            lines:          [],
            labels:         [],
            timeDomain:     data.timeDomain,
        };
        var filteredResources = data.allResources.filter(r => this.resourceInfo[r].on);
        filteredResources.forEach((r) => {
            // Update y domain
            perTickData.yDomain = [
                Math.min(perTickData.yDomain[0], data.perTickResources[r].yDomain[0]),
                Math.max(perTickData.yDomain[1], data.perTickResources[r].yDomain[1]),
            ];

            // Update lines
            var label = this.resourceInfo[r].alternateName || r;
            var color = this.resourceInfo[r].color;
            var sets = data.perTickResources[r].sets;
            sets.forEach((s) => {
                perTickData.lines.push({
                    color:  color,
                    values: s.values,
                });
            });

            // Update labels
            if (sets.length == 0) { return; }
            var lastSet   = sets[sets.length - 1];
            if (lastSet.values.length == 0) { return; }
            var lastValue = lastSet.values[lastSet.values.length - 1];
            perTickData.labels.push({
                label: label,
                color: color,
                y:     lastValue[1]
            });
        });

        // Event graph
        var filteredPurchases = data.purchases.filter(p => this.eventChannels[p.significance].on);
        var eventData = {
            title:          'event log',
            padding:        [this.graphOptions.leftPadding, this.graphOptions.rightPadding, 128, 64],
            baseTimeDomain: data.timeDomain,
            xTicks:         7,
            type:           'eventGraph',
            parent:         'purchasesGraph',

            // EventGraph Specific
            events:         filteredPurchases,

            // Computed
            timeDomain:     data.timeDomain,
        };

        // Resource utilization
        var utilizationData = {
            title:         'resource utilization',
            padding:        [32, 32, 32, 32],
            type:           'radarGraph',
            parent:         'utilizationGraph',

            // RadarGraph Specific

            // Computed
        };

        this.cachedGraphData = [perTickData, eventData];
    },

    buildGraphs: function()
    {
        this.cachedGraphData.forEach((g) => {
            var range = g.baseTimeDomain[1] - g.baseTimeDomain[0];
            g.timeDomain = [
                g.baseTimeDomain[0] + (this.graphManip.leftTrim * range),
                g.baseTimeDomain[1] - (this.graphManip.rightTrim * range)
            ];
        });
        ajk.graphFactory.buildGraphs(this.cachedGraphData);
    },

    zoomGraphs: function(wheelEvent)
    {
        var target = wheelEvent.originalEvent.currentTarget;
        var targetBounds = target.getBoundingClientRect();
        var positionX = (wheelEvent.originalEvent.x - this.graphOptions.leftPadding - targetBounds.x) / (targetBounds.width - this.graphOptions.leftPadding - this.graphOptions.rightPadding);
        var relativeZoomPosition = Math.max(0, Math.min(1, positionX));

        var zoomDelta = -(wheelEvent.originalEvent.deltaY * this.graphManip.zoomSpeed);
        var zoomLeft = relativeZoomPosition * zoomDelta;
        var zoomRight = zoomDelta - zoomLeft;

        this.graphManip.leftTrim += zoomLeft;
        this.graphManip.rightTrim += zoomRight;
        var trimCenter = (this.graphManip.leftTrim + (1 - this.graphManip.rightTrim)) / 2;
        this.graphManip.leftTrim = Math.max(0, Math.min(this.graphManip.leftTrim, trimCenter - (this.graphManip.minTrimSize / 2)));
        this.graphManip.rightTrim = Math.max(0, Math.min(this.graphManip.rightTrim, 1 - (trimCenter + (this.graphManip.minTrimSize / 2))));

        this.buildGraphs();
    },

    init: function()
    {
        this.createLogChannelToggles();

        $('#analysisTabLink').click(function() { ajk.ui.switchToTab('#analysisTab'); });
        $('#graphsTabLink').click(function() { ajk.ui.switchToTab('#graphsTab'); });

        // Register events for accordion panels
        $('.accordion').click(function() { ajk.ui.togglePanel(this); });
        $('.inlineAccordion').click(function() { ajk.ui.togglePanel(this); });

        // Connect controls to callbacks and set initial values
        $('#simulateTickButton').click(function() { ajk.core.simulateTick(true); });
        $('#simulateTockButton').click(function() { ajk.core.simulateTick(false); });

        var simToggle = $('#simulateToggle');
        simToggle.click(function() { ajk.base.simulating = this.checked; });
        simToggle.attr('checked', ajk.base.simulating);

        var tickToggle = $('#tickToggle');
        tickToggle.click(function() { ajk.core.shouldTick(this.checked); });
        tickToggle.attr('checked', ajk.config.ticking);

        var logLevelSelect = $('#logLevelSelect');
        logLevelSelect.change(function() { ajk.log.internal.logLevel = this.value; });
        logLevelSelect.attr('value', ajk.log.internal.logLevel);

        var dsToggle = $('#detailSuccessToggle');
        dsToggle.click(function() { ajk.config.detailedLogsOnSuccess = this.checked; });
        dsToggle.attr('checked', ajk.config.detailedLogsOnSuccess);

        var deToggle = $('#detailErrorToggle');
        deToggle.click(function() { ajk.config.detailedLogsOnError = this.checked; });
        deToggle.attr('checked', ajk.config.detailedLogsOnError);

        var backupToggle = $('#backupToggle');
        backupToggle.click(function() { ajk.backup.shouldPerformBackup(this.checked); });
        backupToggle.attr('checked', ajk.config.performBackups);

        $('#backupSigninButton').click(function() { ajk.backup.handleSignInClick(); });
        $('#backupSignoutButton').click(function() { ajk.backup.handleSignOutClick(); });

        $('#clearStatisticsButton').click(() => {
            ajk.statistics.clear();
            this.updateGraphData();
            this.buildGraphs();
        });

        $('#refreshAnalysisButton').click(() => {
            this.refreshAnalysisUI();
        });

        // Register events for the modal window
        $('#ajkModalWindowOpenButton').click(() => { this.toggleModalDialog(true); });
        $('#ajkModalWindowCloseButton').click(() => { this.toggleModalDialog(false); });
        $(window).click((event) => {
            if (event.target == $('#ajkModalWindow')[0])
            {
                this.toggleModalDialog(false);
            }
        });

        // Register events for the graph container
        this.resizeListener = new ResizeObserver(() => { this.buildGraphs(); });
        this.resizeListener.observe(d3.select('.graphContainer').node());

        $('.graphContainer').on('wheel', (event) => { this.zoomGraphs(event); });
    },

    refresh: function()
    {
        var timerData = ajk.timer.start('UI Refresh');
        if (this.modalDialogOpen)
        {
            this.updateGraphData();
            timerData.interval('Collect Graph Data');
            this.buildGraphs();
            timerData.interval('Build Graphs');
        }
        $('#simulateToggle').attr('checked', ajk.base.simulating);
        $('#tickToggle').attr('checked', ajk.config.ticking);
        $('#logLevelSelect').attr('value', ajk.log.internal.logLevel);
        $('#detailSuccessToggle').attr('checked', ajk.config.detailedLogsOnSuccess);
        $('#detailErrorToggle').attr('checked', ajk.config.detailedLogsOnError);
        $('#backupToggle').attr('checked', ajk.config.performBackups);
        timerData.end('Update Toggle States');
    },

    refreshAnalysis: function(itemData, analysisData)
    {
        this.itemDataCache = itemData;
        this.analysisCache = analysisData;
    },

    buildDecisionTreeOptionNode: function(node, active, labelOverride)
    {
        var a = active;
        var style = active ? 'selected' : 'inactive';
        if (node.method == 'block')
        {
            a = false;
            style = 'blocked';
        }
        return {
            active:   a,
            style:    labelOverride ? 'head' : style,
            label:    labelOverride || node.optionData.method,
            count:    node.actionCount,
            children: node.dependencies.map(d => this.buildDecisionTreeDependencyNode(d, a))
        };
    },

    buildDecisionTreeDependencyNode: function(node, active)
    {
        var style = 'waiting';
        if (node.decisionTime == Infinity || node.capacityBlockers.length > 0) { style = 'blocked'; }
        else if (node.decisionTime == 0) { style = 'ready';   }

        return {
            active:   active,
            style:    active ? style : 'inactive',
            label:    node.costData.resourceName,
            count:    node.deficit,
            children: node.options.map(d => this.buildDecisionTreeOptionNode(d, active && d == node.decision))
        };
    },

    buildDecisionTreeGraph: function()
    {
        if (!this.itemDataCache.hasOwnProperty(this.decisionDetail))
        {
            this.decisionDetail = null;
        }
        if (this.decisionDetail == null && this.analysisCache.priorityOrder.length > 0)
        {
            this.decisionDetail = this.analysisCache.priorityOrder[0];
        }
        if (this.decisionDetail == null) { return; }

        var dNode = this.itemDataCache[this.decisionDetail].decisionTree;
        var graphData = this.buildDecisionTreeOptionNode(dNode, true, this.decisionDetail);
        ajk.graphFactory.buildDecisionTree('decisionTreeContainer', graphData);
    },

    refreshAnalysisUI: function()
    {
        var pTable = $('#priorityTable');
        pTable.empty();

        var aTable = $('#analysisTable');
        aTable.empty();

        var dContainer = $('#decisionTreeContainer');
        dContainer.empty();

        if (this.analysisCache == null) { return; }

        this.analysisCache.priorityOrder.forEach((priority) => {
            var row = document.createElement('tr');

            var nameColumn = document.createElement('td');
            nameColumn.innerHTML = priority;
            nameColumn.addEventListener('click', () => this.setDecisionDetail(priority));
            row.append(nameColumn);

            var timeColumn = document.createElement('td');
            timeColumn.className = 'rightAlignedColumn';
            timeColumn.innerHTML = this.convertTicksToTimeString(this.itemDataCache[priority].decisionTree.maxTime);
            row.append(timeColumn);

            pTable.append(row);
        });


        Object.keys(this.analysisCache.weights).sort((a,b) => (this.analysisCache.weights[b].weight - this.analysisCache.weights[a].weight)).forEach((itemName) => {
            var row = document.createElement('tr');

            var column = document.createElement('td');

            var itemSpan = document.createElement('span');
            itemSpan.className = 'leftText';
            if (this.analysisCache.eligible.indexOf(itemName) == -1)
            {
                itemSpan.className += ' ineligible';
            }
            itemSpan.innerHTML = itemName;
            itemSpan.addEventListener('click', () => this.setDecisionDetail(itemName));
            column.append(itemSpan);

            var itemWeight = document.createElement('span');
            itemWeight.className = 'rightText';
            var weight = this.analysisCache.weights[itemName].weight;
                 if (weight < 0) { itemWeight.className += ' negative'; }
            else if (weight > 0) { itemWeight.className += ' positive'; }
            itemWeight.innerHTML = weight.toFixed(2);
            column.append(itemWeight);

            this.analysisCache.weights[itemName].modifiers.forEach((modifier) => {
                column.append(document.createElement('br'));

                var modSpan = document.createElement('span');
                modSpan.className = 'leftTextMinor';
                modSpan.innerHTML = modifier[0];
                column.append(modSpan);

                var modWeightSpan = document.createElement('span');
                modWeightSpan.className = 'rightTextMinor';
                     if (modifier[1] < 0) { modWeightSpan.className += ' negativeMinor'; }
                else if (modifier[1] > 0) { modWeightSpan.className += ' positiveMinor'; }
                modWeightSpan.innerHTML = modifier[1].toFixed(2);
                column.append(modWeightSpan);
            });

            row.append(column);
            aTable.append(row);
        });

        this.buildDecisionTreeGraph();
    },
};

ajk.ui.init();