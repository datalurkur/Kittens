'use strict';

ajk.ui = {
    log: ajk.log.addChannel('ui', true),

    resourceInfo:
    {
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

    toggleModalDialog: function(visible)
    {
        this.modalDialogOpen = visible;
        if (visible)
        {
            this.updateGraphData();
            this.buildGraphs();
        }
        $('#ajkModalWindow').css('display', visible ? 'block' : 'none');
    },

    toggleGraphResource: function(resource)
    {
        this.resourceInfo[resource].on = !this.resourceInfo[resource].on;
        this.updateGraphData();
        this.buildGraphs();
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

        // Resource toggles
        var toggles = d3.select('.resourceToggleContainer').selectAll('div').data(data.allResources);
        toggles.exit().remove();
        var newToggles = toggles.enter().append('div');

        newToggles.append('input')
            .attr('type', 'checkbox')
            .attr('id', d => d)
            .on('click', d => this.toggleGraphResource(d));
        newToggles.append('label')
            .attr('for', d => d)
            .style('color', (d) => {
                return this.resourceInfo[d].color;
            })
            .text(d => d);

        toggles.selectAll('div input')
            .property('checked', d => this.resourceInfo[d].on);


        var filteredResources = data.allResources.filter(r => this.resourceInfo[r].on);

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
        filteredResources.forEach((r) => {
            // Update y domain
            perTickData.yDomain = [
                Math.min(perTickData.yDomain[0], data.perTickResources[r].yDomain[0]),
                Math.max(perTickData.yDomain[1], data.perTickResources[r].yDomain[1]),
            ];

            // Update lines
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
                label: r,
                color: color,
                y:     lastValue[1]
            });
        });

        // Resource utilization graph
        /*
        // Not super interesting
        var utilizationData = {
            title:         'resources utilization',
            padding:        [this.graphOptions.leftPadding, this.graphOptions.rightPadding, 32, 32],
            baseTimeDomain: data.timeDomain,
            xTicks:         7,
            type:           'lineGraph',
            parent:         'utilizationGraph',

            // LineGraph Specific
            yTicks:         5,
            interpolation:  this.graphOptions.interpolation,
            yTickFormat:    function(d) { return Math.ceil(d * 100) + '%'; },

            // Computed
            yDomain:        [0, 1],
            lines:          [],
            labels:         [],
            timeDomain:     data.timeDomain,
        };
        for (var r in data.utilization)
        {
            // Update y domain
            utilizationData.yDomain = [
                Math.min(utilizationData.yDomain[0], data.utilization[r].yDomain[0]),
                Math.max(utilizationData.yDomain[1], data.utilization[r].yDomain[1]),
            ];

            // Update lines
            var color = this.resourceInfo[r].color;
            var sets = data.utilization[r].sets;
            sets.forEach((s) => {
                utilizationData.lines.push({
                    color:  color,
                    values: s.values,
                });
            });

            // Update labels
            if (sets.length == 0) { return; }
            var lastSet   = sets[sets.length - 1];
            if (lastSet.values.length == 0) { return; }
            var lastValue = lastSet.values[lastSet.values.length - 1];
            utilizationData.labels.push({
                label: r,
                color: color,
                y:     lastValue[1]
            });
        };
        */

        // Event graph
        var eventData = {
            title:          'event log',
            padding:        [this.graphOptions.leftPadding, this.graphOptions.rightPadding, 128, 64],
            baseTimeDomain: data.timeDomain,
            xTicks:         7,
            type:           'eventGraph',
            parent:         'purchasesGraph',

            // EventGraph Specific
            events:         data.purchases,

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

    refreshPriorities: function(itemData, analysisData)
    {
        var table = $('#priorityTable');
        table.empty();

        analysisData.priorityOrder.forEach((priority) => {
            var row = document.createElement('tr');

            var nameColumn = document.createElement('td');
            nameColumn.innerHTML = priority;
            row.append(nameColumn);

            var timeColumn = document.createElement('td');
            timeColumn.className = 'rightAlignedColumn';
            timeColumn.innerHTML = this.convertTicksToTimeString(itemData[priority].decisionTree.maxTime);
            row.append(timeColumn);

            table.append(row);
        });
    },
};

ajk.ui.init();