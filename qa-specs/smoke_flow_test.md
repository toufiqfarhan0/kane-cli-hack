---
mode: testing
url: http://localhost:5173
max_steps: 18
timeout: 90
tags: [studio, smoke]
---

# PostReady smoke: landing, brief step, render library

## Open studio
@import ./shared/open_app.md

## Landing copy
Verify the page contains "PostReady".
Verify Kane CLI is mentioned.
Verify the page contains "Store Product" and "Website & App".
Verify the Product URL field contains "drinkolipop.com".
Verify the Product name field contains "OLIPOP Vintage Cola".

## Brief lists capture steps
Click the button labeled Continue.
Verify the page contains "What should this product video show?".
Verify the page contains "Steps for Kane to capture".

## Render Library
Click Render Library in the header.
Verify the URL contains "/jobs".
Verify the page contains "Render Library".
