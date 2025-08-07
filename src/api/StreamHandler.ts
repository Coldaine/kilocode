import { EventEmitter } from "events"
import { ApiStream, ApiStreamChunk } from "../transform/stream"
import { countTokens } from "../utils/countTokens" // kilocode_change
import { Anthropic } from "@anthropic-ai/sdk"

export interface ChunkData {
	text: string
	tokenCount: number
}

export class StreamHandler extends EventEmitter {
	private hasStarted = false

	constructor(private modelName: string) {
		super()
	}

	async handleApiStream(stream: ApiStream): Promise<string> {
		console.log("[StreamHandler] Starting handleApiStream", { modelName: this.modelName }) // kilocode_change
		let fullText = ""

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				console.log("[StreamHandler] Processing text chunk", { text: chunk.text.substring(0, 100) + "..." }) // kilocode_change
				// Start tracking on first text chunk
				if (!this.hasStarted) {
					this.hasStarted = true
					this.emit("streamStarted", this.modelName)
				}

				// Count tokens in chunk using existing utility
				const tokenCount = await countTokens([{ type: "text", text: chunk.text }], { useWorker: false })

				// Emit event for monitoring
				this.emit("chunkReceived", {
					text: chunk.text,
					tokenCount,
				} as ChunkData)

				fullText += chunk.text
			}
		}

		// Emit stream ended event
		if (this.hasStarted) {
			this.emit("streamEnded")
		}

		return fullText
	}
}
