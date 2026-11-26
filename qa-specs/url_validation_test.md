---
mode: testing
url: http://localhost:5173
max_steps: 16
timeout: 180
tags: [studio]
---

# Product step rejects an empty URL

## Open generate
@import ./shared/open_app.md

## Clear URL and continue
Select the Product URL field.
Delete all of its contents so the field is empty.
Click the button labeled Continue.
Verify the page still shows the Product step.
Verify the page contains "Please enter a product link." or the Product URL field is still empty and Continue did not open the Brief step titled "What should this product video show?".
Store the visible error text as 'url_required_message'.
Do not click Create product short.
