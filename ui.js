'use strict';

ajk.ui = {
    panelState: {},

    // Callbacks
    togglePanel: function(panelHeader)
    {
        var panel = $(panelHeader).next()[0];
        var collapsed = (panel.style.display == 'none');
        panel.style.display = (collapsed ? 'block' : 'none');
        this.panelState[panel.id] = !collapsed;
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

    convertAmountToShortString: function(amount)
    {
        // kilo, mega, giga, tera, peta, exa, zetta, yotta
        var postFixes = ['', 'k', 'M', 'P', 'T', 'P', 'E', 'Z', 'Y'];
        index = 0;
        while (amount > 1000 && index < postFixes.length - 1)
        {
            amount /= 1000;
            index += 1;
        }
        var amountString = (index == 0) ? Math.ceil(amount) : amount.toFixed(2);
        return amountString + postFixes[index];
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

    buildGraphs: function(snapshots)
    {
        var width = 256;
        var height = 256;
        var minX = 0;
        var maxX = 0;
        var minY = 0;
        var maxY = 0;
        var keys = [];
        if (snapshots.length != 0)
        {
            keys = Object.keys(snapshots[0]);
            minX = snapshots[snapshots.length - 1].time;
            maxX = snapshots[0].time;
            minY = d3.min(snapshots, function(d) { return d3.min(Object.values(d.resources)); });
            minY = d3.max(snapshots, function(d) { return d3.max(Object.values(d.resources)); });
        }
        var x = d3.time.scale.utc().domain(minX, maxX).range([0, width]);
        var y = d3.scale.linear().domain(minY, maxY).range([height, 0]);
        var xAxis = d3.svg.axis().scale(x).orient('bottom');
        var yAxis = d3.svg.axis().scale(y).orient('left');
        var line = d3.svg.line()
            .x(function(d) { return x(d[0]); })
            .y(function(d) { return y(d[1]); });
        var svg = d3.select('#resourceProductionGraph').append('svg')
            .attr('width', width + 32)
            .attr('height', height + 32)
            .append('g').attr('transform', 'translate(16,16)');
        svg.append('g')
            .attr('class', 'axis axis--y')
            .attr('transform', 'translate(-10,0)')
            .call(yAxis);
        svg.append('g')
            .attr('class', 'axis axis--x')
            .attr('transform', 'translate(0,' + (height + 10) + ')')
            .call(xAxis);
        keys.forEach((key) => {
            svg.append('path').
                datum(d3.map(snapshots, (d) => { return d.resources[key]; }))
                .attr('clas', 'line')
                .attr('d', line);
        });
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

        // Register events for the modal window
        $('#ajkModalWindowOpenButton').click(function() { $('#ajkModalWindow').css('display', 'block'); });
        $('#ajkModalWindowCloseButton').click(function() { $('#ajkModalWindow').css('display', 'none'); });
        $(window).click(function(event)
        {
            var modal = $('#ajkModalWindow');
            if (event.target == modal[0])
            {
                modal.css('display', 'none');
            }
        });
    },

    refresh: function()
    {
        $('#simulateToggle').attr('checked', ajk.base.simulating);
        $('#tickToggle').attr('checked', ajk.config.ticking);
        $('#logLevelSelect').attr('value', ajk.log.internal.logLevel);
        $('#detailSuccessToggle').attr('checked', ajk.config.detailedLogsOnSuccess);
        $('#detailErrorToggle').attr('checked', ajk.config.detailedLogsOnError);
        $('#backupToggle').attr('checked', ajk.config.performBackups);
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