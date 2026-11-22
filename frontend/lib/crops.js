/**
 * Crop and disease cues used to restrict the AI to the diseases that really occur on a crop.
 * A short closed list is much easier for a vision model than "any disease in the world".
 *
 * `reviewed` is false until an agronomist or agriculture officer has checked the cues.
 * Only tomato has been tried against labelled photos so far (PlantVillage sample).
 */

export const CROPS = {
  tomato: {
    name: 'Tomato',
    reviewed: false,
    diseases: {
      early_blight: 'brown spots with concentric rings (target-like), often with a yellow halo, usually on older leaves',
      late_blight: 'large irregular dark, water-soaked or greasy patches; may have white fuzz at the edge in humid weather',
      septoria_leaf_spot: 'MANY small round spots with grey or white centres and dark borders',
      leaf_mold: 'pale green-yellow patches on the upper surface; olive-grey mould on the underside',
    },
  },
  chilli: {
    name: 'Chilli',
    reviewed: false,
    diseases: {
      leaf_curl: 'leaves curl upward or inward, small and thick, stunted plant (often from thrips, mites or virus)',
      cercospora_leaf_spot: 'round spots with a pale centre and dark border (frog-eye)',
      powdery_mildew: 'white powdery coating on the leaf surface, yellow patches on top',
      anthracnose: 'sunken circular dark spots on fruit, or dark spots on leaves and stems',
    },
  },
  cotton: {
    name: 'Cotton',
    reviewed: false,
    diseases: {
      leaf_curl_virus: 'thickened dark veins, upward leaf curl, small leaf-like outgrowths under the leaf',
      bacterial_blight: 'angular water-soaked spots limited by veins, turning brown',
      alternaria_leaf_spot: 'brown round spots with concentric rings',
      grey_mildew: 'angular pale yellow patches on the upper surface, powdery grey growth underneath',
    },
  },
  paddy: {
    name: 'Paddy (rice)',
    reviewed: false,
    diseases: {
      blast: 'diamond or spindle-shaped lesions with a grey centre and brown border',
      brown_spot: 'small oval brown spots, often with a yellow halo',
      bacterial_leaf_blight: 'yellow to white wavy streaks starting at the leaf tip or edges',
      sheath_blight: 'greenish-grey oval lesions near the water line on the sheath',
      tungro: 'yellow to orange leaves and stunted plants',
    },
  },
};

export const CROP_IDS = Object.keys(CROPS);

/** Safe, dose-free actions the plant is allowed to recommend (the AI picks one, never invents a dose). */
export const ADVICE_OPTIONS = [
  'remove the worst affected leaves and keep them away from the plant',
  'water at the base and keep the leaves dry',
  'give the plants more space and air',
  'ask the agriculture officer which spray is right for this problem and the correct dose',
  'take another photo (closer, in daylight, show the underside of the leaf)',
  'keep checking the plant every day and take another photo in three days',
];

export function cropLabel(id) {
  if (CROPS[id]) return CROPS[id].name;
  return String(id).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
