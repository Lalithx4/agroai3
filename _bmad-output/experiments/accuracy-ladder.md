# Accuracy ladder: tomato leaf diagnosis without training

Date: 2026-11-22. Source: PlantVillage tomato images (lab photos, 256 px, upscaled to 512 or 768).
Test set: 20 images, 4 per class (early blight, late blight, leaf mold, septoria leaf spot, healthy). Reference photos for the
few-shot rows: 2 per class (10 total), different images from the test set (small chance of overlap, not checked).
All runs: Amazon Bedrock, temperature 0, closed list of 5 labels. One run each.

| Step | Correct | Healthy leaves wrongly flagged | Median time | Avg input tokens |
|---|---|---|---|---|
| Haiku 4.5, bare prompt (open label list) | 4/20 | 4/4 | 1.7 s | 914 |
| Haiku 4.5, cues + describe-first prompt | 5/20 | 1/4 | 1.9 s | 1108 |
| Haiku 4.5, Voice Doctor prompt (with guard) | 6/20 | 2/4 | 3.3 s | n/a |
| Haiku 4.5, closed list, short prompt | 8/20 | 0/4 | 1.2 s | 429 |
| Haiku 4.5 + 10 reference photos | 11/20 | 2/4 | 2.5 s | 4154 |
| Claude Opus 4.5, closed list, short prompt | 15/20 | 0/4 | 2.2 s | 429 |
| Claude Opus 4.5 + 10 reference photos | 18/20 | 0/4 | 3.7 s | 4154 |

Claude Sonnet 4.5 was not available on this AWS account (marked legacy).

## What this does and does not show
- Bigger model and reference photos each help; together they gave 90% on this small test. Haiku never got above 55%.
- 20 images is tiny: one image is 5 percentage points. Differences of 1 to 2 images mean nothing.
- Lab photos on a plain background are easier than real field photos. Expect lower numbers on phone photos taken in a field.
- Not measured: field photos, other crops (chilli, cotton, paddy), model stated-confidence calibration, cost on the real bill.
- Next: repeat on 100+ photos from the district, including a held-out set that is never used for choosing prompts or reference photos.

Script used: a throwaway Node script (Bedrock Converse API, sharp for resizing). Rebuild it from `frontend/lib/voice-doctor.js` if needed.
