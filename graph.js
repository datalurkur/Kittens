ajk.graphFactory = {
    buildGraphs: function(container, graphData)
    {
        var container = d3.select(container);
        var width = container.node().getBoundingClientRect().width;

        if (width == 0) { return; }

        graphData.forEach((d) => {
            d.xScale = d3.time.scale()
                .domain(d.timeDomain)
                .range([d.padding[0], width - d.padding[1]]);
            d.yScale = d3.scale.linear()
                .domain(d.yDomain)
                .range([d.height - d.padding[2], d.padding[3]]);
            d.lines.forEach((l) => {
                l.xScale  = d.xScale;
                l.yScale  = d.yScale;
                l.padding = d.padding;
            });
            d.labels.forEach((l) => {
                l.xScale  = d.xScale;
                l.yScale  = d.yScale;
                l.padding = d.padding;
            })
        });

        var svgs = container.selectAll('svg').data(graphData);

        // Remove old
        svgs.exit().remove();

        // Create new
        var newSVGs = svgs.enter().append('svg');
        newSVGs.append('g').attr('class', 'x axis');
        newSVGs.append('g').attr('class', 'y axis');
        newSVGs.append('text').attr('class', 'title').text(d => d.title);
        newSVGs.append('clipPath').attr('id', 'clip')
            .append('rect')
                .attr('fill', 'none');

        // Update SVG sizes
        svgs.attr('width', d => width).attr('height', d => d.height);

        // Update clip rect
        svgs.select('clipPath#clip rect')
            .attr('width', d => (width - d.padding[0] - d.padding[1]))
            .attr('height', d => (d.height - d.padding[2] - d.padding[3]))
            .attr('x', d => d.padding[0])
            .attr('y', d => d.padding[2]);

        // Update axes
        var xAxes = svgs.select('g.x.axis');
        xAxes.attr('transform', d => 'translate(0, ' + (d.height - d.padding[2]) + ')')
        xAxes.each(function(d) {
            d3.svg.axis()
                .scale(d.xScale)
                .ticks(d.xTicks)
                .tickFormat(d3.time.format('%H:%M'))
                .orient('bottom')(d3.select(this));
        });
        var yAxes = svgs.select('g.y.axis');
        yAxes.attr('transform', d => 'translate(' + (d.padding[0] - 10) + ', 0)');
        yAxes.each(function(d) {
            d3.svg.axis()
                .scale(d.yScale)
                .ticks(d.yTicks)
                .tickFormat(d.yTickFormat)
                .orient('left')(d3.select(this));
        });

        // Update title position
        svgs.select('text.title').attr('transform', d => 'translate(' + d.padding[0] + ', ' + (d.padding[2] - 5) + ')');

        // Update lines
        var lines = svgs.selectAll('path.line').data(d => d.lines);
        lines.exit().remove();
        lines.enter().append('path')
            .attr('class', 'line')
            .attr('clip-path', 'url(#clip)');

        lines.attr('d', (d) => {
                return d3.svg.line()
                    .x(v => d.xScale(v[0]))
                    .y(v => d.yScale(v[1]))
                    .interpolate(d.interpolation)(d.values);
            })
            .style('stroke', d => d.color);

        // Update labels
        var labels = svgs.selectAll('text.lineLabel').data(d => d.labels);
        labels.exit().remove();
        labels.enter().append('text')
            .attr('class', 'lineLabel');
        labels.attr('transform', d => 'translate(' + (width - d.padding[1] + 5) + ', ' + (d.yScale(d.y) + 4) + ')')
            .text(d => d.label)
            .style('fill', d => d.color);
    },
}