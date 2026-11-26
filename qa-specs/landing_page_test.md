---
mode: testing
url: http://localhost:5173
max_steps: 16
timeout: 180
tags: [studio, smoke]
---

# PostReady landing and branding

## Open generate
@import ./shared/open_app.md

## Branding
Verify the heading "PostReady" is visible.
Verify the page contains "TestMu AI" and "Kane CLI".
Verify the header contains "Short Studio", "Render Library", "QA Guardrails", and "Product Deck".
Verify the page contains "Store Product" and "Website & App".

## Product step defaults
Verify the page contains "Paste any storefront product URL".
Verify the Product URL field contains "drinkolipop.com".
Verify the Product name field contains "OLIPOP Vintage Cola".
Store the Product name field value as 'default_product'.
Verify a Continue button is visible.
Do not click Continue.
Do not click Create product short.
