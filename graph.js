ajk.graphFactory = {
    buildGraphs: function(graphData)
    {
        graphData.forEach((d) => {
            if (d.type == 'lineGraph')
            {
                this.buildLineGraph(d);
            }
            else if (d.type == 'eventGraph')
            {
                this.buildEventGraph(d);
            }
            else if (d.type == 'radarGraph')
            {
                this.buildRadarGraph(d);
            }
        });
    },

    buildLineGraph: function(graphData)
    {
        var container = d3.select('#' + graphData.parent);
        var containerDimensions = container.node().getBoundingClientRect();

        if (containerDimensions.width == 0 || containerDimensions.height == 0) { return; }

        var xScale = d3.time.scale()
            .domain(graphData.timeDomain)
            .range([graphData.padding[0], containerDimensions.width - graphData.padding[1]]);
        var yScale = d3.scale.linear()
            .domain(graphData.yDomain)
            .range([containerDimensions.height - graphData.padding[2], graphData.padding[3]]);

        var svg = container.selectAll('svg').data([graphData]);
        // Create if it doesn't exist
        var newSVG = svg.enter().append('svg');
        newSVG.append('g').attr('class', 'x axis');
        newSVG.append('g').attr('class', 'y axis');
        newSVG.append('text').attr('class', 'title').text(d => d.title);
        newSVG.append('clipPath').attr('id', graphData.parent + 'Clip').append('rect');

        // Update SVG size
        svg.attr('width', containerDimensions.width).attr('height', containerDimensions.height);

        // Update clip rect
        svg.select('clipPath rect')
            .attr('width', d => (containerDimensions.width - graphData.padding[0] - graphData.padding[1]))
            .attr('height', d => (containerDimensions.height - graphData.padding[2] - graphData.padding[3]))
            .attr('x', d => graphData.padding[0])
            .attr('y', d => graphData.padding[2]);

        // Update axes
        var xAxis = svg.select('g.x.axis');
        xAxis.attr('transform', d => 'translate(0, ' + yScale(0) + ')')
        xAxis.each(function(d) {
            d3.svg.axis()
                .scale(xScale)
                .ticks(d.xTicks)
                .tickFormat(d3.time.format('%H:%M'))
                .orient('bottom')(d3.select(this));
        });
        var yAxis = svg.select('g.y.axis');
        yAxis.attr('transform', d => 'translate(' + (graphData.padding[0] - 10) + ', 0)');
        yAxis.each(function(d) {
            d3.svg.axis()
                .scale(yScale)
                .ticks(d.yTicks)
                .tickFormat(d.yTickFormat)
                .orient('left')(d3.select(this));
        });

        // Update title position
        svg.select('text.title').attr('transform', d => 'translate(' + graphData.padding[0] + ', ' + 24 + ')');

        // Update lines
        var lines = svg.selectAll('path.line').data(d => d.lines);
        lines.exit().remove();
        lines.enter().append('path')
            .attr('class', 'line')
            .attr('clip-path', 'url(#' + graphData.parent + 'Clip)');

        lines.attr('d', (d) => {
                return d3.svg.line()
                    .x(v => xScale(v[0]))
                    .y(v => yScale(v[1]))
                    .interpolate(d.interpolation)(d.values);
            })
            .style('stroke', d => d.color);

        // Update labels
        var labels = svg.selectAll('text.lineLabel').data(d => d.labels);
        labels.exit().remove();
        labels.enter().append('text')
            .attr('class', 'lineLabel');
        labels.attr('transform', d => 'translate(' + (containerDimensions.width - graphData.padding[1] + 5) + ', ' + (yScale(d.y) + 4) + ')')
            .text(d => d.label)
            .style('fill', d => d.color);
    },

    buildEventGraph: function(graphData)
    {
        var ttPadding = 5;

        var container = d3.select('#' + graphData.parent);
        var containerDimensions = container.node().getBoundingClientRect();

        if (containerDimensions.width == 0 || containerDimensions.height == 0) { return; }

        var xScale = d3.time.scale()
            .domain(graphData.timeDomain)
            .range([graphData.padding[0], containerDimensions.width - graphData.padding[1]]);

        var svg = container.selectAll('svg').data([graphData]);
        // Create if it doesn't exist
        var newSVG = svg.enter().append('svg');
        newSVG.append('g').attr('class', 'x axis');
        newSVG.append('text').attr('class', 'title').text(d => d.title);
        newSVG.append('clipPath').attr('id', graphData.parent + 'Clip').append('rect');
        newSVG.append('g').attr('class', 'groupContainer');

        // Update SVG size
        svg.attr('width', containerDimensions.width).attr('height', containerDimensions.height);

        // Update clip rect
        svg.select('clipPath rect')
            .attr('width', d => (containerDimensions.width - graphData.padding[0] - graphData.padding[1]))
            .attr('height', d => containerDimensions.height)
            .attr('x', d => graphData.padding[0])
            .attr('y', d => 0);

        // Update axes
        var xAxes = svg.select('g.x.axis');
        xAxes.attr('transform', d => 'translate(0, ' + graphData.padding[3] + ')')
        xAxes.each(function(d) {
            d3.svg.axis()
                .scale(xScale)
                .ticks(d.xTicks)
                .tickFormat(d3.time.format('%H:%M'))
                .innerTickSize([16])
                .orient('top')(d3.select(this));
        });

        // Update title position
        svg.select('text.title').attr('transform', d => 'translate(' + graphData.padding[0] + ', ' + 24 + ')');

        // Update event groups
        var eventGroups = svg.select('g.groupContainer').selectAll('g.eventGroup').data(d => d.events);
        eventGroups.exit().remove();
        var newEventGroups = eventGroups.enter()
            .append('g')
                .attr('clip-path', 'url(#' + graphData.parent + 'Clip)')
                .attr('class', 'eventGroup');
        newEventGroups.append('text')
            .attr('class', 'eventLabel');
        newEventGroups.append('circle')
            .attr('class', 'eventBubble');

        // Create tooltip
        var newTooltip = newSVG.append('g')
            .attr('class', 'tooltip')
            .style('opacity', 0);
        newTooltip.append('rect')
            .attr('class', 'tooltipContainer')
            .attr('rx', 5)
            .attr('ry', 5);
        newTooltip.append('text').attr('class', 'tooltipText');

        var tooltip = svg.select('g.tooltip');

        // Update event group properties
        eventGroups.select('circle.eventBubble')
            .attr('class', (d) => {
                     if (d.significance < 3) { return 'eventBubble minor'; }
                else if (d.significance > 4) { return 'eventBubble major'; }
                else                         { return 'eventBubble';       }
            })
            .attr('cx', d => xScale(d.time))
            .attr('cy', graphData.padding[3])
            .attr('r', 8)
            .on('mouseover', (d) => {
                var lineSpacing = 16;

                tooltip.attr('transform', 'translate(' + xScale(d.time) + ', ' + (graphData.padding[3] + 16) + ')')
                    .style('opacity', 1);

                var tooltipText = tooltip.select('text.tooltipText')
                    .attr('x', 0)
                    // Couldn't explain why this offset is necessary - text and rect seem have minds of their own when it comes to what "x" and "y" mean relative to the parent node
                    .attr('y', ttPadding + 11);

                var tooltipLines = tooltipText.selectAll('tspan').data(d.list);
                tooltipLines.exit().remove();
                tooltipLines.enter().append('tspan');

                tooltipLines.text(e => e[0])
                    .attr('class', (e) => {
                             if (e[1] < 3) { return 'minor';  }
                        else if (e[1] > 4) { return 'major';  }
                        else               { return 'normal'; }
                    })
                    .attr('x', ttPadding + 'px')
                    .attr('dy', (e,i) => { return ((i == 0) ? 0 : lineSpacing) + 'px'; });

                tooltip.select('rect.tooltipContainer')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('width',  tooltipText.node().getBBox().width + (ttPadding * 2))
                    .attr('height', tooltipText.node().getBBox().height + (ttPadding * 2));
            })
            .on('mouseout', (d) => {
                tooltip.style('opacity', 0);
            });

        eventGroups.select('text.eventLabel').text(d => d.label)
            .attr('transform', d => 'translate(' + (xScale(d.time) - 3) + ', ' + (graphData.padding[3] + 16) + ') rotate(90)');
    },
}