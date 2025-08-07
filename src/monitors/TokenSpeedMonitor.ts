import * as vscode from "vscode"
import { EventEmitter } from "events"

// Configuration constants
const SPEED_BUFFER_SIZE = 10
const DISPLAY_THROTTLE_MS = 100
const POST_TRACKING_DISPLAY_MS = 5000
const METRICS_UPDATE_INTERVAL_MS = 500

interface TokenDataPoint {
	count: number
	timestamp: number
}

export interface TokenSpeedMetrics {
	currentSpeed: number // tokens/second
	averageSpeed: number // average over session
	peakSpeed: number // highest recorded
	totalTokens: number
	elapsedTime: number // seconds
}

export class TokenSpeedMonitor extends EventEmitter {
	private statusBarItem: vscode.StatusBarItem
	private currentMetrics: TokenSpeedMetrics
	private isTracking: boolean = false
	private startTime: number = 0
	private tokenBuffer: TokenDataPoint[] = []
	private lastDisplayUpdate: number = 0
	private metricsUpdateInterval: NodeJS.Timeout | null = null
	private hideTimeout: NodeJS.Timeout | null = null

	constructor() {
		super()

		// kilocode_change - Super obvious initialization logging
		console.log("🚀 [SPEEDOMETER] TokenSpeedMonitor constructor called!")
		vscode.window.showInformationMessage("🚀 Speedometer initialized and ready!")

		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.workspace.getConfiguration("kilocode.speedometer").get("position") === "left"
				? vscode.StatusBarAlignment.Left
				: vscode.StatusBarAlignment.Right,
			100,
		)
		this.statusBarItem.tooltip = "Token generation speed (click for details)"
		this.statusBarItem.command = "kilocode.showSpeedDetails"

		// kilocode_change - Make status bar item super obvious for testing
		this.statusBarItem.text = "🚀 SPEEDOMETER READY"
		this.statusBarItem.show()

		this.resetMetrics()
	}

	public startTracking(modelName: string): void {
		this.clearTimeouts()
		this.isTracking = true
		this.startTime = Date.now()
		this.resetMetrics()
		this.statusBarItem.show()

		// kilocode_change - Super obvious visual indicator for testing
		vscode.window
			.showInformationMessage(`🚀 SPEEDOMETER ACTIVATED! Tracking ${modelName} token speed...`, "View Details")
			.then((selection) => {
				if (selection === "View Details") {
					vscode.commands.executeCommand("kilocode.showSpeedDetails")
				}
			})

		// kilocode_change - Also log to console for debugging
		console.log(`[SPEEDOMETER] 🚀 STARTED TRACKING: ${modelName} at ${new Date().toISOString()}`)

		// Emit periodic metrics updates for live view
		this.metricsUpdateInterval = setInterval(() => {
			if (this.isTracking) {
				this.emit("metricsUpdated", this.currentMetrics)
			}
		}, METRICS_UPDATE_INTERVAL_MS)

		this.emit("trackingStarted", { model: modelName })
	}

	public addTokens(count: number): void {
		if (!this.isTracking || count === 0) return

		const now = Date.now()
		this.currentMetrics.totalTokens += count

		// kilocode_change - Super obvious logging when tokens are added
		console.log(`[SPEEDOMETER] 📊 TOKENS ADDED: +${count} (total: ${this.currentMetrics.totalTokens})`)

		// Add timestamped data point
		this.tokenBuffer.push({ count, timestamp: now })

		// Keep only recent data points
		const cutoffTime = now - SPEED_BUFFER_SIZE * DISPLAY_THROTTLE_MS
		this.tokenBuffer = this.tokenBuffer.filter((point) => point.timestamp > cutoffTime)

		this.calculateSpeed()
		this.throttledUpdateDisplay()
	}

	public stopTracking(): void {
		this.isTracking = false
		this.clearTimeouts()

		// kilocode_change - Super obvious completion notification
		console.log(
			`[SPEEDOMETER] 🏁 TRACKING STOPPED: ${this.currentMetrics.totalTokens} tokens in ${this.currentMetrics.elapsedTime}s`,
		)
		vscode.window
			.showInformationMessage(
				`🏁 Speedometer finished! Generated ${this.currentMetrics.totalTokens} tokens at ${this.currentMetrics.averageSpeed.toFixed(1)} t/s average`,
				"View Final Stats",
			)
			.then((selection) => {
				if (selection === "View Final Stats") {
					vscode.commands.executeCommand("kilocode.showSpeedDetails")
				}
			})

		this.emit("trackingEnded", this.currentMetrics)

		// Keep display visible for a few seconds after completion
		this.hideTimeout = setTimeout(() => {
			if (!this.isTracking) {
				this.statusBarItem.hide()
			}
		}, POST_TRACKING_DISPLAY_MS)
	}

	private calculateSpeed(): void {
		const now = Date.now()
		const elapsed = (now - this.startTime) / 1000
		this.currentMetrics.elapsedTime = elapsed

		if (elapsed > 0) {
			// Calculate current speed based on recent tokens with actual timestamps
			if (this.tokenBuffer.length > 1) {
				const recentTokens = this.tokenBuffer.reduce((sum, point) => sum + point.count, 0)
				const timeSpan = (now - this.tokenBuffer[0].timestamp) / 1000
				if (timeSpan > 0) {
					this.currentMetrics.currentSpeed = recentTokens / timeSpan
				}
			}

			// Average speed
			this.currentMetrics.averageSpeed = this.currentMetrics.totalTokens / elapsed

			// Peak speed
			if (this.currentMetrics.currentSpeed > this.currentMetrics.peakSpeed) {
				this.currentMetrics.peakSpeed = this.currentMetrics.currentSpeed
			}
		}
	}

	private throttledUpdateDisplay(): void {
		const now = Date.now()
		if (now - this.lastDisplayUpdate >= DISPLAY_THROTTLE_MS) {
			this.updateDisplay()
			this.lastDisplayUpdate = now
		}
	}

	private updateDisplay(): void {
		if (!this.isTracking) return

		const speed = this.currentMetrics.currentSpeed
		const showIcon = vscode.workspace.getConfiguration("kilocode.speedometer").get("showIcon", true)
		const icon = showIcon ? this.getSpeedIcon(speed) + " " : ""

		this.statusBarItem.text = `${icon}${speed.toFixed(1)} t/s`
	}

	private getSpeedIcon(speed: number): string {
		if (speed < 10) return "🐌"
		if (speed < 30) return "🚶"
		if (speed < 60) return "🏃"
		if (speed < 100) return "🚗"
		return "🚀"
	}

	public resetMetrics(): void {
		this.currentMetrics = {
			currentSpeed: 0,
			averageSpeed: 0,
			peakSpeed: 0,
			totalTokens: 0,
			elapsedTime: 0,
		}
		this.tokenBuffer = []
	}

	private clearTimeouts(): void {
		if (this.metricsUpdateInterval) {
			clearInterval(this.metricsUpdateInterval)
			this.metricsUpdateInterval = null
		}
		if (this.hideTimeout) {
			clearTimeout(this.hideTimeout)
			this.hideTimeout = null
		}
	}

	public dispose(): void {
		this.clearTimeouts()
		this.statusBarItem.dispose()
	}
}
