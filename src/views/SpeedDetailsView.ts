import * as vscode from 'vscode';
import { TokenSpeedMonitor, TokenSpeedMetrics } from '../monitors/TokenSpeedMonitor';

export class SpeedDetailsViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private speedHistory: {time: number, speed: number}[] = [];
    
    constructor(
        private extensionUri: vscode.Uri,
        private tokenSpeedMonitor: TokenSpeedMonitor
    ) {
        // Listen for both live updates and completion
        this.tokenSpeedMonitor.on('metricsUpdated', (metrics) => {
            this.updateView(metrics, false);
        });
        
        this.tokenSpeedMonitor.on('trackingEnded', (metrics) => {
            this.updateView(metrics, true);
        });
        
        this.tokenSpeedMonitor.on('trackingStarted', () => {
            this.speedHistory = [];
            if (this.view) {
                this.view.webview.postMessage({ type: 'reset' });
            }
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {
        this.view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };
        
        webviewView.webview.html = this.getHtmlContent();
    }

    private getHtmlContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        padding: 10px; 
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                    }
                    .metric { 
                        margin: 10px 0; 
                        display: flex;
                        justify-content: space-between;
                    }
                    .metric-label { 
                        font-weight: bold; 
                    }
                    .metric-value { 
                        color: var(--vscode-charts-blue);
                        font-family: var(--vscode-editor-font-family);
                    }
                    .speed-chart { 
                        width: 100%; 
                        height: 150px; 
                        margin-top: 20px;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .status {
                        margin-top: 10px;
                        padding: 5px;
                        border-radius: 3px;
                        text-align: center;
                    }
                    .status.tracking {
                        background-color: var(--vscode-inputValidation-infoBackground);
                        color: var(--vscode-inputValidation-infoForeground);
                    }
                    .status.complete {
                        background-color: var(--vscode-inputValidation-successBackground);
                        color: var(--vscode-inputValidation-successForeground);
                    }
                </style>
            </head>
            <body>
                <h3>Token Generation Metrics</h3>
                <div class="metric">
                    <span class="metric-label">Current Speed:</span>
                    <span class="metric-value" id="current-speed">0.0 t/s</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Average Speed:</span>
                    <span class="metric-value" id="avg-speed">0.0 t/s</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Peak Speed:</span>
                    <span class="metric-value" id="peak-speed">0.0 t/s</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Tokens:</span>
                    <span class="metric-value" id="total-tokens">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Duration:</span>
                    <span class="metric-value" id="duration">0.0s</span>
                </div>
                <div class="status" id="status" style="display: none;"></div>
                <canvas id="speed-chart" class="speed-chart"></canvas>
                <script>
                    const vscode = acquireVsCodeApi();
                    const canvas = document.getElementById('speed-chart');
                    const ctx = canvas.getContext('2d');
                    let speedHistory = [];
                    const maxPoints = 60;
                    
                    // Set canvas size
                    canvas.width = canvas.offsetWidth;
                    canvas.height = canvas.offsetHeight;
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        if (message.type === 'reset') {
                            speedHistory = [];
                            drawChart();
                            document.getElementById('status').style.display = 'none';
                            return;
                        }
                        
                        const metrics = message.metrics;
                        const isComplete = message.isComplete;
                        
                        // Update metrics
                        document.getElementById('current-speed').textContent = 
                            metrics.currentSpeed.toFixed(1) + ' t/s';
                        document.getElementById('avg-speed').textContent = 
                            metrics.averageSpeed.toFixed(1) + ' t/s';
                        document.getElementById('peak-speed').textContent = 
                            metrics.peakSpeed.toFixed(1) + ' t/s';
                        document.getElementById('total-tokens').textContent = 
                            metrics.totalTokens.toLocaleString();
                        document.getElementById('duration').textContent = 
                            metrics.elapsedTime.toFixed(1) + 's';
                        
                        // Update status
                        const statusEl = document.getElementById('status');
                        if (isComplete) {
                            statusEl.textContent = 'Generation Complete';
                            statusEl.className = 'status complete';
                            statusEl.style.display = 'block';
                        } else if (speedHistory.length === 0) {
                            statusEl.textContent = 'Tracking...';
                            statusEl.className = 'status tracking';
                            statusEl.style.display = 'block';
                        }
                        
                        // Update chart data
                        speedHistory.push({
                            time: metrics.elapsedTime,
                            speed: metrics.currentSpeed
                        });
                        
                        if (speedHistory.length > maxPoints) {
                            speedHistory.shift();
                        }
                        
                        drawChart();
                    });
                    
                    function drawChart() {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        
                        if (speedHistory.length < 2) return;
                        
                        const padding = 10;
                        const chartWidth = canvas.width - padding * 2;
                        const chartHeight = canvas.height - padding * 2;
                        
                        // Find max speed for scaling
                        const maxSpeed = Math.max(...speedHistory.map(p => p.speed), 10);
                        
                        // Draw grid lines
                        ctx.strokeStyle = getComputedStyle(document.body)
                            .getPropertyValue('--vscode-panel-border');
                        ctx.lineWidth = 0.5;
                        
                        for (let i = 0; i <= 5; i++) {
                            const y = padding + (chartHeight / 5) * i;
                            ctx.beginPath();
                            ctx.moveTo(padding, y);
                            ctx.lineTo(canvas.width - padding, y);
                            ctx.stroke();
                        }
                        
                        // Draw line chart
                        ctx.strokeStyle = getComputedStyle(document.body)
                            .getPropertyValue('--vscode-charts-blue');
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        
                        speedHistory.forEach((point, index) => {
                            const x = padding + (chartWidth / (maxPoints - 1)) * index;
                            const y = padding + chartHeight - (point.speed / maxSpeed) * chartHeight;
                            
                            if (index === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.lineTo(x, y);
                            }
                        });
                        
                        ctx.stroke();
                    }
                </script>
            </body>
            </html>
        `;
    }

    private updateView(metrics: TokenSpeedMetrics, isComplete: boolean): void {
        if (this.view) {
            this.view.webview.postMessage({ 
                metrics, 
                isComplete,
                type: 'update'
            });
        }
    }
}