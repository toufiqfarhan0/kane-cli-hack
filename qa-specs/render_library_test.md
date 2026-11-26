---
mode: testing
url: http://localhost:5173
max_steps: 20
timeout: 180
tags: [studio, smoke]
---

# PostReady Render Library and Production Inspector

## Open generate
@import ./shared/open_app.md

## Open Render Library
Click Render Library in the header.
Verify the URL contains "/jobs".
Verify the page contains "Render Library".
Store the visible Render Library heading as 'gallery_heading'.
Verify the page contains "Total renders".
Verify the page contains "Short" or "Website" or "Walkthrough" or "No shorts yet".

## Open a job if one exists
```yaml
optional: true
```
If a job tile is visible, click the first tile.
While still on that job page, verify the URL contains "/jobs/" followed by an id (not only "/jobs").
Verify the page contains "Kane CLI" or "Render Preview" or "Back to Render Library".
Do not stop or cancel a running job.
After those checks, click Render Library in the header to return to the list.
Do not assert a job-id URL after leaving the job page.
Do not click Create product short.
