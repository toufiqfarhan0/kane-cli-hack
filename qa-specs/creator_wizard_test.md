---
mode: testing
url: http://localhost:5173
max_steps: 24
timeout: 240
tags: [studio]
---

# PostReady wizard Product through Launch

## Open generate
@import ./shared/open_app.md

## Product to Brief
Verify the wizard rail contains Product, Brief, Style, and Launch.
Click the button labeled Continue.
Verify the page contains "What should this product video show?".
Verify a field labeled "What is this video about?" is visible.
Verify the page contains "Steps for Kane to capture" and "Add step".

## Brief to Style
Click the button labeled Continue.
Verify the page contains "Choose format, look, and voice".
Verify the page contains "Director AI" and "Video size".
Verify the page contains "AI voiceover".

## Style to Launch
Click only the button whose visible label is Continue. Do not click Create product short. Do not press Enter.
Wait until the heading contains "Ready to create".
Verify the URL is still the generate page (no "/jobs/" in the path).
Store the h2 panel title that contains "Ready to create" as 'launch_heading'.
Store the current URL as 'wizard_url'.
Verify the page contains "Create product short" and "drinkolipop.com".
Do not click Create product short.

## Back stays in wizard
Click the button labeled Back.
Verify the page contains "Choose format, look, and voice".
Do not click Create product short.
