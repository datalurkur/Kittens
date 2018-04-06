ajk.graphFactory = {
    buildGraphs: function(container, graphData)
    {
        var container = d3.select(container);
        var width = container.node().getBoundingClientRect().width;

        if (width == 0) { return; }

        graphData.forEach((d) => {
            d.xScale = d3.time.scale()
                .domain(d.timeDomain)
                .range([d.padding, width - (d.padding * 3)]);
            var testValue = d.xScale(1522974443754);
            var testValue2 = d.xScale(1522975428837);
            d.yScale = d3.scale.linear()
                .domain(d.yDomain)
                .range([d.height - d.padding, d.padding]);
            d.lines.forEach((l) => {
                l.xScale  = d.xScale;
                l.yScale  = d.yScale;
                l.padding = d.padding;
            });
        });

        var svgs = container.selectAll('svg').data(graphData);

        // Remove old
        svgs.exit().remove();

        // Create new
        var newSVGs = svgs.enter().append('svg');
        newSVGs.append('g').attr('class', 'x axis');
        newSVGs.append('g').attr('class', 'y axis');
        newSVGs.append('text').attr('class', 'title').text(d => d.title);

        // Update SVG sizes
        svgs.attr('width', d => width).attr('height', d => d.height);

        // Update axes
        var xAxes = svgs.select('g.x.axis');
        xAxes.attr('transform', d => 'translate(0, ' + (d.height - d.padding) + ')')
        xAxes.each(function(d) {
            d3.svg.axis()
                .scale(d.xScale)
                .ticks(d.xTicks)
                .tickFormat(d3.time.format('%H:%M'))
                .orient('bottom')(d3.select(this));
        });
        var yAxes = svgs.select('g.y.axis');
        yAxes.attr('transform', d => 'translate(' + (d.padding - 10) + ', 0)');
        yAxes.each(function(d) {
            d3.svg.axis()
                .scale(d.yScale)
                .ticks(d.yTicks)
                .tickFormat(d.yTickFormat)
                .orient('left')(d3.select(this));
        });

        // Update title position
        svgs.select('text.title').attr('transform', d => 'translate(' + d.padding + ', ' + (d.padding - 5) + ')');

        // Update lines
        var lineGroups = svgs.selectAll('g.lineGroup').data(d => d.lines);
        lineGroups.exit().remove();
        var newLineGroups = lineGroups.enter().append('g')
            .attr('class', 'lineGroup');

        newLineGroups.append('path')
            .attr('class', 'line');
        newLineGroups.append('text')
            .attr('class', 'lineLabel');

        lineGroups.select('path.line')
            .attr('d', (d) => {
                return d3.svg.line()
                    .x(v => d.xScale(v[0]))
                    .y(v => d.yScale(v[1]))
                    .interpolate(d.interpolation)(d.values);
            })
            .style('stroke', d => d.color);

        lineGroups.select('text.lineLabel')
            .attr('transform', d => 'translate(' + (width - (d.padding * 3) + 5) + ', ' + (d.yScale(d.lastValue[1]) + 4) + ')')
            .text(d => d.label)
            .style('fill', d => d.color);
    },
}