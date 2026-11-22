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

### Second round: other models on the same account, same 20 images, same 10 reference photos

| Model (price per million tokens in / out) | Zero-shot | + 10 reference photos | Cost per scan with photos | Time with photos |
|---|---|---|---|---|
| Claude Sonnet 4.6 ($3 / $15) | 11/20 | **19/20** | about Rs 1.1 | 3.4 s |
| Claude Opus 4.6 ($5 / $25) | 12/20 | 18/20 | about Rs 1.85 | 3.0 s |
| Claude Opus 4.5 ($5 / $25) | 15/20 | 17/20 (one reply failed to parse; 18/20 in round one) | about Rs 1.8 | 3.8 s |

Costs use measured token counts (about 4,150 input tokens with 10 photos) and Rs 88 per US dollar.
Not usable on this account (listed in Bedrock but "not available for this account"): Sonnet 5.5, Sonnet 5, Opus 5.5, Opus 5,
Opus 4.8, Haiku 5.5, Sonnet 4.5 (legacy). Model access may need to be enabled in the Bedrock console. Sonnet 5.5 would cost
$2 / $10 per million tokens, so about Rs 0.7 to 1.0 per scan with photos (calculated, not measured).
Differences of one or two images (5 to 10 points) are within noise on a 20-image test.
Main finding: reference photos help far more (+6 to +8 images) than moving to a bigger model.

## What this does and does not show
- Bigger model and reference photos each help; together they gave 90% on this small test. Haiku never got above 55%.
- 20 images is tiny: one image is 5 percentage points. Differences of 1 to 2 images mean nothing.
- Lab photos on a plain background are easier than real field photos. Expect lower numbers on phone photos taken in a field.
- Not measured: field photos, other crops (chilli, cotton, paddy), model stated-confidence calibration, cost on the real bill.
- Next: repeat on 100+ photos from the district, including a held-out set that is never used for choosing prompts or reference photos.

Script used: a throwaway Node script (Bedrock Converse API, sharp for resizing). Rebuild it from `frontend/lib/voice-doctor.js` if needed.
