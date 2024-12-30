// Dashboard functionality
const API_ENDPOINTS = {
    containerStatus: '/api/containers/status',
    functionStatus: '/api/functions/status',
    metrics: '/api/metrics',
    activity: '/api/activity'
};

// Initialize charts
const resourceChart = new Chart(
    document.getElementById('resourceChart').getContext('2d'),
    {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'CPU Usage',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                },
                {
                    label: 'Memory Usage',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    }
);

const activityChart = new Chart(
    document.getElementById('activityChart').getContext('2d'),
    {
        type: 'bar',
        data: {
            labels: ['Code Analysis', 'AI Agent', 'Vector Search', 'Improvements'],
            datasets: [{
                label: 'Function Calls',
                data: [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)',
                    'rgba(54, 162, 235, 0.2)'
                ],
                borderColor: [
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)',
                    'rgb(255, 159, 64)',
                    'rgb(54, 162, 235)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    }
);

// Update container status
async function updateContainerStatus() {
    try {
        const response = await fetch('/api/containers/status');
        const data = await response.json();
        
        for (const container of ['200', '201', '202']) {
            const card = document.querySelector(`[data-container="${container}"]`);
            const statusBadge = card.querySelector('.status-badge');
            const memoryUsage = card.querySelector('.memory-usage');
            
            statusBadge.textContent = data[container].status;
            statusBadge.className = `status-badge px-2 py-1 rounded ${
                data[container].status === 'running' ? 'bg-green-200' : 'bg-red-200'
            }`;
            
            memoryUsage.textContent = `${data[container].memory_usage}MB`;
            
            // Update specific container info
            if (container === '200') {
                card.querySelector('.model-info').textContent = data[container].model;
            } else if (container === '201') {
                card.querySelector('.collections-info').textContent = data[container].collections;
            } else if (container === '202') {
                card.querySelector('.tools-info').textContent = data[container].active_tools;
            }
        }
    } catch (error) {
        console.error('Failed to update container status:', error);
    }
}

// Update function status
async function updateFunctionStatus() {
    try {
        const response = await fetch('/api/functions/status');
        const data = await response.json();
        
        // Update Code Analyzer status
        document.querySelector('.analyzer-status').textContent = data.analyzer.status;
        document.querySelector('.last-run').textContent = data.analyzer.last_run;
        document.querySelector('.files-analyzed').textContent = data.analyzer.files_analyzed;
        
        // Update AI Agent status
        document.querySelector('.agent-status').textContent = data.agent.status;
        document.querySelector('.active-tasks').textContent = data.agent.active_tasks;
        document.querySelector('.improvements').textContent = data.agent.improvements;
    } catch (error) {
        console.error('Failed to update function status:', error);
    }
}

// Update metrics charts
async function updateMetrics() {
    try {
        const response = await fetch('/api/metrics');
        const data = await response.json();
        
        // Update resource chart
        resourceChart.data.labels = data.timestamps;
        resourceChart.data.datasets[0].data = data.cpu_usage;
        resourceChart.data.datasets[1].data = data.memory_usage;
        resourceChart.update();
        
        // Update activity chart
        activityChart.data.datasets[0].data = [
            data.function_calls.analyzer,
            data.function_calls.agent,
            data.function_calls.vector_search,
            data.function_calls.improvements
        ];
        activityChart.update();
    } catch (error) {
        console.error('Failed to update metrics:', error);
    }
}

// Update activity log
async function updateActivityLog() {
    try {
        const response = await fetch('/api/activity');
        const data = await response.json();
        
        const tbody = document.getElementById('activity-log');
        tbody.innerHTML = data.activities.map(activity => `
            <tr>
                <td class="px-4 py-2">${activity.timestamp}</td>
                <td class="px-4 py-2">${activity.function}</td>
                <td class="px-4 py-2">${activity.action}</td>
                <td class="px-4 py-2">
                    <span class="px-2 py-1 rounded ${
                        activity.status === 'success' ? 'bg-green-200' : 'bg-red-200'
                    }">
                        ${activity.status}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to update activity log:', error);
    }
}

// Update all dashboard components
async function updateDashboard() {
    await Promise.all([
        updateContainerStatus(),
        updateFunctionStatus(),
        updateMetrics(),
        updateActivityLog()
    ]);
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    updateDashboard();
    // Update dashboard every 30 seconds
    setInterval(updateDashboard, 30000);
});
