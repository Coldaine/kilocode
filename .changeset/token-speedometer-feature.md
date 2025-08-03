---
"kilo-code": minor
---

Add real-time token generation speedometer

- Adds a real-time token generation speed monitor that displays tokens per second (t/s) in the VS Code status bar during LLM interactions
- Shows fun emoji indicators based on speed: 🐌 (<10 t/s), 🚶 (10-30 t/s), 🏃 (30-60 t/s), 🚗 (60-100 t/s), 🚀 (>100 t/s)
- Includes a detailed metrics panel showing current, average, and peak speeds with a live chart
- Configurable through settings: enable/disable, status bar position, and icon display
- Helps developers understand model performance and make informed decisions about model selection