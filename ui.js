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
    },

    graphOptions:
    {
        interpolation: 'monotone',
        interpolationOptions: ['monotone', 'cardinal', 'step-after', 'linear'],
    },

    panelState: {},

    modalDialogOpen: false,
    graphs: {},

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
            this.updateGraphs();
        }
        $('#ajkModalWindow').css('display', visible ? 'block' : 'none');
    },

    toggleGraphResource: function(resource)
    {
        this.resourceInfo[resource].on = !this.resourceInfo[resource].on;
        this.updateGraphs();
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

    buildGraphs: function()
    {
        var width = 1200;
        var height = 1024;

        var formatter = function(d) { return d3.format('.2s')(d * 5 * 60) + ' / m'; };

        var gData = ajk.graphFactory.buildGraph('resourceProductionGraph', 'Resource Production', width, height, 11, formatter, 1);
        this.graphs.resourcePerTickGraph = gData;
    },

    updateGraphs: function()
    {
        var data = ajk.statistics.getAll();

        var timeDomain = d3.extent(data.map(d => d.time));
        var allResources = Object.keys(this.resourceInfo).map((r) => {
            var values = data.map((s) => {
                return {
                    time:         s.time,
                    resourceData: s.resources[r]
                };
            });
            return {
                id:          r,
                color:       this.resourceInfo[r].color,
                values:      values,
                lastValue:   values[values.length - 1]
            };
        });

        var toggles = d3.select('.resourceToggleContainer').selectAll('div').data(allResources);

        var newToggles = toggles.enter().append('div');
        newToggles.append('input')
            .attr('type', 'checkbox')
            .attr('id', d => d.id)
            .on('click', d => this.toggleGraphResource(d.id));
        newToggles.append('label').attr('for', d => d.id).style('color', d => d.color).text(d => d.id);

        toggles.exit().remove();

        toggles.selectAll('div input')
            .property('checked', d => this.resourceInfo[d.id].on);

        this.updateResourcePerTickGraph(timeDomain, allResources);
    },

    updateResourcePerTickGraph: function(timeDomain, allResources)
    {
        // Resource production
        var perTickResources = allResources.map((r) => {
            if (!this.resourceInfo[r.id].on) { return null; }

            if (r.values.length == 0) { return null; }

            var extent = d3.extent(r.values.map(v => v.resourceData.perTick).reduce((a,v) => { return a.concat(v); }, []));
            if (extent[0] == 0 && extent[1] == 0) { return null; }
            r.perTickExtent = extent;

            return r;
        }).filter(r => r != null);

        var rptG = this.graphs.resourcePerTickGraph;
        var yScalePadding = 0.05;
        var xDomain = timeDomain;
        var yDomain = d3.extent(
            perTickResources.map(function(r) { return r.perTickExtent; }).reduce(function(a,v) { return a.concat(v); }, [])
        );

        var yRange = yDomain[1] - yDomain[0];
        yDomain[0] -= (yRange * yScalePadding);
        yDomain[1] += (yRange * yScalePadding);
        rptG.updateDomain(xDomain, yDomain);

        var line = d3.svg.line()
            .x((d) => { return rptG.xScale(d.time);                 })
            .y((d) => { return rptG.yScale(d.resourceData.perTick); })
            .interpolate(this.graphOptions.interpolation);

        // Get all elements
        var resourceNode = rptG.svg.selectAll('g.resource')
            .data(perTickResources);

        // Create new elements
        var newResources = resourceNode.enter().append('g')
            .attr('class', 'resource');
        newResources.append('path')
            .attr('class', 'line');
        newResources.append('text')
            .attr('class', 'lineLabel');

        // Remove old elements
        resourceNode.exit().remove();

        // Update existing elements
        resourceNode.select('path')
            .attr('d', function(d) { return line(d.values); })
            .style('stroke', function(d) { return d.color; })
            .attr('transform', null);
            /*
            // TODO - Figure out how to animate the graph prettily
            .transition()
            .duration(ajk.config.tickFrequency * 1000)
            .attr('transform', 'translate(' + rptG.xScale(timeDomain[0] - (ajk.config.tickFrequency * 1000)) + ', 0)');
            */
        resourceNode.select('text')
            .attr('transform', (d) => {
                return 'translate(' + (rptG.x1 + 5) + ',' + (rptG.yScale(d.lastValue.resourceData.perTick) + 5) + ')';
            })
            .style('fill', function(d) { return d.color; })
            .text(function(d) { return d.id; });
    },

    init: function()
    {
        this.createLogChannelToggles();

        // Register events for accordion panels
        $('.accordion').click(function() { ajk.ui.togglePanel(this); });
        $('.inlineAccordion').click(function() { ajk.ui.togglePanel(this); });

        // Connect controls to callbacks and set initial values
        $('#simulateButton').click(function() { ajk.core.simulateTick(); });

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
            ajk.statistics.internal.clearSnapshots();
            this.updateGraphs();
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

        this.buildGraphs();
    },

    refresh: function()
    {
        $('#simulateToggle').attr('checked', ajk.base.simulating);
        $('#tickToggle').attr('checked', ajk.config.ticking);
        $('#logLevelSelect').attr('value', ajk.log.internal.logLevel);
        $('#detailSuccessToggle').attr('checked', ajk.config.detailedLogsOnSuccess);
        $('#detailErrorToggle').attr('checked', ajk.config.detailedLogsOnError);
        $('#backupToggle').attr('checked', ajk.config.performBackups);

        if (this.modalDialogOpen) { this.updateGraphs(); }
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