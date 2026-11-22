# Reference photos (examples shown to the AI)

Folder layout: `reference-photos/<crop>/<diagnosis_id>/<photo>.jpg`

- `<crop>` is the crop id used by the app (tomato, chilli, cotton, paddy, ...).
- `<diagnosis_id>` is a lowercase id such as `healthy`, `late_blight`, `leaf_curl`. Use the same ids as in `lib/crops.js`.
- 2 photos per folder are used by default (`REFERENCE_PHOTOS_PER_CLASS`). More is not always better: each photo adds about 400 input tokens per scan.
- Use clear, well-lit photos of the leaf. Add your own field photos for the district's crops.
- Keep test photos OUT of these folders, otherwise the accuracy numbers are inflated.

## Sources
- `tomato/`, `potato/`, `corn/`, `grape/`, `apple/`, `pepper_bell/`: the first 1 to 2 photos of each group from the PlantVillage dataset (Hughes and Salathe, https://github.com/spMohanty/PlantVillage-Dataset), fetched with `node scripts/fetch-plantvillage-refs.mjs Tomato Potato Corn Grape Apple Pepper`. These are lab photos on plain backgrounds. Check the dataset's licence before publishing or redistributing.
- To add more PlantVillage crops: `node scripts/fetch-plantvillage-refs.mjs Cherry Peach Strawberry Squash Soybean Orange Blueberry Raspberry`. For chilli, cotton and paddy (not in PlantVillage) add your own photos.

Adding a crop = adding a folder. No training and no code change.
