'use strict';

ajk.jobs = {
    internal:
    {
        log: ajk.log.addChannel('jobs', true),

        cachedJobs:         {},
        cachedResources:    {},

        jobPriority:
        {
            'farmer':     0,
            'woodcutter': 1,
            'miner':      2,
            'hunter':     3,
            'scholar':    4,
            'geologist':  5,
            'priest':     6,
        },

        jobRatio:
        {
            'farmer':     0,
            'woodcutter': 10,
            'hunter':     8,
            'miner':      6,
            'geologist':  6,
            'priest':     6,
            'scholar':    1,
        },

        chooseLeader: function()
        {
            if (ajk.base.censusAvailable() && ajk.base.getLeader() == null)
            {
                // For now, just always pick a leader with a crafting bonus
                var kittenInfo = ajk.base.getKittenInfo();
                for (var i = 0; i < kittenInfo.length; ++i)
                {
                    if (kittenInfo[i].trait != null && kittenInfo[i].trait.name == 'engineer')
                    {
                        var k = kittenInfo[i];
                        this.log.info('Assigned ' + k.name + ' ' + k.surname + ' as the kitten leader');
                        ajk.base.makeLeader(k);
                        break;
                    }
                }
            }
        },

        optimizeJobs: function()
        {
            if (ajk.base.censusAvailable()) { ajk.base.optimizeJobs(); }
        },

        updateJobTable: function()
        {
            this.cachedJobs = {};
            ajk.base.getAllJobs().forEach((j) => {
                if (j.unlocked && j.name != 'engineer')
                {
                    this.cachedJobs[j.name] = {
                        jobData:                j,
                        produces:               Object.keys(j.modifiers),
                        producers:              j.value,
                        nullProductionComputed: false
                    };
                }
            });
        },

        computeProductionVectors: function()
        {
            this.updateJobTable();
            this.cachedResources = {};

            var totalKittens = ajk.base.getKittenInfo().length;
            var jobList      = Object.keys(this.cachedJobs);

            // Check if it event makes sense to do this computation
            if (jobList < 2 || totalKittens == 0)
            {
                jobList.forEach((j) => {
                    var job = this.cachedJobs[j];
                    this.cachedJobs[j].produces.forEach((r) => {
                        this.cachedResources[r] = { approxPerProducer: 0 };
                    });
                });
                return;
            }

            // Pool all kittens in a job, and compute relevant data
            jobList.forEach((j) => {
                // Switch all kittens to this job
                ajk.base.clearJobs();
                ajk.base.assignJobs(this.cachedJobs[j].jobData, totalKittens);
                ajk.base.updateVillageResourceProduction();

                // Collection production stats for this job
                this.cachedJobs[j].produces.forEach((r) => {
                    ajk.util.ensureKey(this.cachedResources, r, {}).estimatedProduction = ajk.base.getAccurateResPerTick(r);
                });

                // Collect null production stats for other jobs
                jobList.forEach((k) => {
                    if (k == j) { return; }
                    if (this.cachedJobs[k].nullProductionComputed) { return; }
                    this.cachedJobs[k].produces.forEach((r) => {
                        ajk.util.ensureKey(this.cachedResources, r, {}).nullProduction = ajk.base.getAccurateResPerTick(r);
                    });
                    this.cachedJobs[k].nullProductionComputed = true;
                });
            });

            // Compute perProducer contribution from the previous data
            jobList.forEach((j) => {
                this.cachedJobs[j].produces.forEach((r) => {
                    this.cachedResources[r].approxPerProducer = (this.cachedResources[r].estimatedProduction - this.cachedResources[r].nullProduction) / totalKittens;
                });
            });

            // Remove all workers
            ajk.base.clearJobs();
        },

        balanceJobs: function(majorUpdate, utilization)
        {
            var timer = ajk.timer.start('Job Balancing');

            var totalKittens   = ajk.base.getKittenInfo().length;
            var jobAssignments = {};

            if (majorUpdate)
            {
                timer.interval('Compute Production Vectors');
                this.computeProductionVectors();
            }

            // Collect current job data
            var currentJobData = {};
            ajk.base.getAllJobs().forEach((j) => {
                currentJobData[j.name] = j;
            });

            // Assign new jobs
            var jobPriorityOrder = Object.keys(this.cachedJobs).sort((a, b) => { return this.jobPriority[a] - this.jobPriority[b]; });

            // (1) Bring production vectors to 0 in priority order
            jobPriorityOrder.forEach((jobName) => {
                var workersRequired = this.cachedJobs[jobName].produces.reduce((a, r) => {
                    if (this.cachedResources[r].nullProduction > 0)
                    {
                        return a;
                    }
                    if (this.cachedResources[r].approxPerProducer == 0)
                    {
                        this.log.detail('No data collected on per-kitten production of ' + r + ', assigning at least one kitten to compensate for non-positive resource vector');
                        return Math.max(a, 1);
                    }

                    var req = Math.max(0, Math.ceil(-this.cachedResources[r].nullProduction / this.cachedResources[r].approxPerProducer));
                    this.log.detail(req + ' kittens needed to reach at least 0 production for ' + r);
                    return Math.max(a, req);
                }, 0);

                var workers = Math.min(totalKittens, workersRequired);
                this.log.debug('Assigning ' + workers + ' kittens to be ' + jobName + 's to reach 0-vector');
                ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                totalKittens -= workers;
            });
            timer.interval('Normalize Production Vectors');

            // (2) Determine fixed / floating numbers
            var floatingJobs = jobPriorityOrder.filter(j => j != 'farmer'); // We don't need floating farmers
            var utilDenom = floatingJobs.reduce((a, j) => {
                return a + this.cachedJobs[j].produces.reduce((b, r) => { return b + (utilization[r] || 0); }, 0);
            }, 0);
            var floaters    = Math.floor(totalKittens * ajk.config.kittenFloaterRatio);
            var nonFloaters = totalKittens - floaters;
            if (utilDenom == 0)
            {
                this.log.debug('No utilization data available, floaters will be split with non-floaters');
                nonFloaters += floaters;
                floaters = 0;
            }
            this.log.debug(nonFloaters + ' kittens will be spread evenly across production, with ' + floaters + ' floating between jobs to satisfy utilization demands');

            // (3) Apply fixed positions according to hardcoded ratios
            var ratioDenom = jobPriorityOrder.reduce((a, j) => { return a + (this.jobRatio[j] || 0); }, 0);
            jobPriorityOrder.forEach((jobName) => {
                var workers = Math.min(totalKittens, Math.ceil(nonFloaters * (this.jobRatio[jobName] || 0) / ratioDenom));
                this.log.debug('Assigning ' + workers + ' kittens to be fixed ' + jobName + 's');
                ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                totalKittens -= workers;
            });
            timer.interval('Assign Fixed Roles');

            // (4) Apply floating positions based on utilization
            if (floaters > 0)
            {
                floatingJobs.forEach((jobName) => {
                    var jobUtilization = this.cachedJobs[jobName].produces.reduce((a, r) => { return a + (utilization[r] || 0); }, 0);
                    var workers = Math.min(totalKittens, Math.ceil(floaters * jobUtilization / utilDenom));
                    this.log.debug('Assigning ' + workers + ' kittens to be floating ' + jobName + 's');
                    ajk.util.ensureKeyAndModify(jobAssignments, jobName, 0, workers);
                    totalKittens -= workers;
                });
            }
            timer.interval('Assign Floating Roles');

            // (5) Finish up
            if (totalKittens > 0)
            {
                this.log.warn('Unassigned kittens left - something went wrong in job assignment');
            }

            // Apply job asignments
            // Unassign surplus workers
            for (var jobName in currentJobData)
            {
                var targetWorkers = (jobAssignments[jobName] || 0);
                var delta = currentJobData[jobName].value - jobAssignments[jobName];
                if (delta > 0)
                {
                    this.log.debug('Removing ' + delta + ' surplus ' + jobName + 's');
                    if (!ajk.base.removeJobs(currentJobData[jobName], delta))
                    {
                        this.log.error('Failed to remove ' + jobName + 's');
                    }
                }
            }
            // Assign lacking workers
            for (var jobName in currentJobData)
            {
                var targetWorkers = (jobAssignments[jobName] || 0);
                var delta = jobAssignments[jobName] - currentJobData[jobName].value;
                if (delta > 0)
                {
                    this.log.debug('Assigning ' + delta + ' new ' + jobName + 's');
                    if (!ajk.base.assignJobs(currentJobData[jobName], delta))
                    {
                        this.log.error('Failed to assign ' + jobName + 's');
                    }
                }
            }
            timer.interval('Assign Jobs');

            // Balance
            this.optimizeJobs();
            timer.end('Optimize Jobs');
        },
    },

    update: function(majorUpdate, utilization)
    {
        this.internal.chooseLeader();
        this.internal.balanceJobs(majorUpdate, utilization);
    },
};