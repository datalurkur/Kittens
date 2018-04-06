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
    cachedGraphData: [],
    resizeListener:  null,

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
        this.log.debug('Updating graph data');
        var data = ajk.statistics.getAll();

        // Used for multiple graphs
        var resourceList = Object.keys(this.resourceInfo);
        var timeDomain = d3.extent(data.map(d => d.time));

        // Resource toggles
        var toggles = d3.select('.resourceToggleContainer').selectAll('div').data(resourceList);
        toggles.exit().remove();
        var newToggles = toggles.enter().append('div');

        newToggles.append('input')
            .attr('type', 'checkbox')
            .attr('id', d => d)
            .on('click', d => this.toggleGraphResource(d));
        newToggles.append('label')
            .attr('for', d => d)
            .style('color', d => this.resourceInfo[d].color)
            .text(d => d);

        toggles.selectAll('div input')
            .property('checked', d => this.resourceInfo[d].on);

        var filteredResourceList = resourceList.filter(r => this.resourceInfo[r].on);

        // Per tick graph
        var perTickLines = filteredResourceList.map((r) => {
            var values = data.map((s) => {
                return [s.time, s.resources[r].perTick];
            });
            var valueDomain = d3.extent(values.map(v => v[1]));
            return {
                label:       r,
                color:       this.resourceInfo[r].color,
                values:      values,
                lastValue:   values[values.length - 1],
                valueDomain: valueDomain
            };
        }).filter(r => r.valueDomain[0] != 0 || r.valueDomain[1] != 0);
        var yDomain = d3.extent(perTickLines.map(v => v.valueDomain).reduce((a,v) => { return a.concat(v); }, []));
        var perTickData = {
            title: 'net resources / second',
            interpolation: 'step-after',
            padding: 64,
            height: 512,
            timeDomain: timeDomain,
            yDomain: yDomain,
            xTicks: 7,
            yTicks: 9,
            yTickFormat: function(d) { return d3.format('.2s')(d * 5) + ' / s'; },
            lines: perTickLines,
            interpolation: this.graphOptions.interpolation
        };
        this.cachedGraphData = [perTickData];
    },

    buildGraphs: function()
    {
        this.log.debug('Rebuilding graphs');
        ajk.graphFactory.buildGraphs('.graphContainer', this.cachedGraphData);
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

        this.resizeListener = new ResizeObserver(() => { this.buildGraphs(); });
        this.resizeListener.observe(d3.select('.graphContainer').node());
    },

    refresh: function()
    {
        $('#simulateToggle').attr('checked', ajk.base.simulating);
        $('#tickToggle').attr('checked', ajk.config.ticking);
        $('#logLevelSelect').attr('value', ajk.log.internal.logLevel);
        $('#detailSuccessToggle').attr('checked', ajk.config.detailedLogsOnSuccess);
        $('#detailErrorToggle').attr('checked', ajk.config.detailedLogsOnError);
        $('#backupToggle').attr('checked', ajk.config.performBackups);

        if (this.modalDialogOpen)
        {
            this.updateGraphData();
            this.buildGraphs();
        }
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