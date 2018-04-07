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
        });
    },

    buildLineGraph: function(graphData)
    {
        var container = d3.select(graphData.parent);
        var containerDimensions = container.node().getBoundingClientRect();

        if (containerDimensions.width == 0 || containerDimensions.height == 0) { return; }

        var xScale = d3.time.scale()
            .domain(graphData.timeDomain)
            .range([graphData.padding[0], containerDimensions.width - graphData.padding[1]]);
        var yScale = d3.scale.linear()
            .domain(graphData.yDomain)
            .range([graphData.height - graphData.padding[2], graphData.padding[3]]);

        var svg = container.selectAll('svg').data([graphData]);
        // Create if it doesn't exist
        var newSVG = svg.enter().append('svg');
        newSVG.append('g').attr('class', 'x axis');
        newSVG.append('g').attr('class', 'y axis');
        newSVG.append('text').attr('class', 'title').text(d => d.title);
        newSVG.append('clipPath').attr('id', 'clip')
            .append('rect')
                .attr('fill', 'none');

        // Update SVG size
        svg.attr('width', containerDimensions.width).attr('height', containerDimensions.height);

        // Update clip rect
        svg.select('clipPath#clip rect')
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
        svg.select('text.title').attr('transform', d => 'translate(' + graphData.padding[0] + ', ' + 32 + ')');

        // Update lines
        var lines = svg.selectAll('path.line').data(d => d.lines);
        lines.exit().remove();
        lines.enter().append('path')
            .attr('class', 'line')
            .attr('clip-path', 'url(#clip)');

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
        var container = d3.select(graphData.parent);
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
        newSVG.append('clipPath').attr('id', 'clip')
            .append('rect')
                .attr('fill', 'none');
        newSVG.append('text')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        var tooltip = svg.select('text.tooltip');

        // Update SVG size
        svg.attr('width', containerDimensions.width).attr('height', containerDimensions.height);

        // Update clip rect
        svg.select('clipPath#clip rect')
            .attr('width', d => (containerDimensions.width - graphData.padding[0] - graphData.padding[1]))
            .attr('height', d => (containerDimensions.height - graphData.padding[2] - graphData.padding[3]))
            .attr('x', d => graphData.padding[0])
            .attr('y', d => graphData.padding[2]);

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
        svg.select('text.title').attr('transform', d => 'translate(' + graphData.padding[0] + ', ' + 32 + ')');

        // Update event bubbles
        var eventBubbles = svg.selectAll('circle.eventBubble').data(d => d.events);
        eventBubbles.exit().remove();
        var newEventBubbles = eventBubbles.enter().append('circle')
            .attr('class', 'eventBubble');

        eventBubbles.attr('cx', d => xScale(d[0]))
            .attr('cy', graphData.padding[3])
            .attr('r', 8)
            .on('mouseover', (d) => {
                var text = d[1].join('\n');
                tooltip.attr('transform', 'translate(' + xScale(d[0]) + ', ' + (graphData.padding[3] + 24) + ')')
                    .style('opacity', 1);

                var tooltipLines = tooltip.selectAll('tspan').data(d[1]);
                tooltipLines.exit().remove();
                tooltipLines.enter().append('tspan');

                tooltipLines.text(e => e)
                    .attr('x', '0px')
                    .attr('dy', (e,i) => { return (i * 16) + 'px'; });
            })
            .on('mouseout', (d) => {
                tooltip.transition().duration(200).style('opacity', 0);
            });
    },
}