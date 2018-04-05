ajk.graphFactory = {
    padding: 64,

    buildGraph: function(parentId, title, width, height, numYTicks, yTickFormatter, powerScaling)
    {
        var x0 = this.padding;
        var x1 = width - (this.padding * 3);
        var y0 = height - this.padding;
        var y1 = this.padding;

        var xScale = d3.time.scale().domain([0, 1]).range([x0, x1]);

        var yScaleType;
        if (powerScaling != 1)
        {
            yScaleType = d3.scale.pow().exponent(powerScaling);
        }
        else
        {
            yScaleType = d3.scale.linear();
        }
        var yScale = yScaleType.domain([0,1]).range([y0, y1]);

        var svg = d3.select('#' + parentId)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0, 0)');

        svg.append('g')
            .attr('class', 'y axis')
            .attr('transform', 'translate(' + (x0 - 10) + ', 0)');

        svg.append('text')
            .attr('class', 'title')
            .attr('transform', 'translate(' + ((x1 - x0) / 2) + ', ' + y1 + ')')
            .text(title);

        var graphData = {
            x0:       x0,
            x1:       x1,
            y0:       y0,
            y1:       y1,
            xScale:   xScale,
            yScale:   yScale,
            svg:      svg,
            width:    width,
            height:   height,
            power:    powerScaling,
            yTicks:   numYTicks,
            yForm:    yTickFormatter,

            createAxes: function()
            {
                var xAxis = d3.svg.axis()
                    .scale(this.xScale)
                    .ticks(10)
                    .tickFormat(d3.time.format('%H:%M'))
                    .orient('bottom');

                this.svg.select('g.x.axis')
                    .attr('transform', 'translate(' + 0 + ',' + this.yScale(0) + ')')
                    .call(xAxis);

                var yAxis = d3.svg.axis()
                    .scale(this.yScale)
                    .ticks(this.yTicks)
                    .tickFormat(this.yForm)
                    .orient('left');

                if (this.power != 1)
                {
                    var ticks = [];
                    var min = this.yScale.domain()[0];
                    var max = this.yScale.domain()[1];
                    var minPow = -Math.pow(-min, this.power);
                    var maxPow = Math.pow(max, this.power);
                    var powRange = maxPow - minPow;
                    for (var i = 0; i < this.yTicks; ++i)
                    {
                        var iRatio = i / (this.yTicks - 1);
                        var powVal = iRatio * powRange + minPow;
                        var realVal = Math.sign(powVal) * Math.pow(Math.abs(powVal), 1 / this.power);
                        ticks.push(realVal);
                    }
                    yAxis.tickValues(ticks);
                }

                this.svg.select('g.y.axis')
                    .attr("transform", "translate(" + (this.x0 - 10) + ", 0)")
                    .call(yAxis);
            },

            updateDomain: function(xDomain, yDomain)
            {
                // Always include 0 in the y domain
                var cleanedYDomain = d3.extent(yDomain.concat([0]));
                this.xScale.domain(xDomain);
                this.yScale.domain(cleanedYDomain);

                this.createAxes();
            },
        };

        graphData.createAxes();

        return graphData;
    }
}