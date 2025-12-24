const portraits = import.meta.glob('../assets/character_portrait/*.{tif,tiff}', { eager: true, query: '?url', import: 'default' });

const normalizeKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const extractKeyFromPortraitPath = (path = '') => {
    const fileName = path.split('/').pop() ?? '';
    const withoutExt = fileName.replace(/\.(tif|tiff)$/i, '');
    const withoutPrefix = withoutExt.replace(/^LEADERS[-_]/i, '');
    return normalizeKey(withoutPrefix);
};

const portraitEntries = Object.entries(portraits)
    .map(([path, url]) => ({ path, url, key: extractKeyFromPortraitPath(path) }))
    .filter(entry => entry.url);

// Hermit & Cub is a single character card. The cub portrait (ourson) should not be draftable on its own.
const NON_DRAFTABLE_KEYS = new Set(['ourson']);

const urlToKey = new Map(portraitEntries.map(entry => [entry.url, entry.key]));

const expandDualExcludeKeys = (excludeKeys = new Set()) => {
    // Hermit and Cub is 1 card: if either is excluded, exclude both.
    if (excludeKeys.has('ourson') || excludeKeys.has('vieilours')) {
        excludeKeys.add('ourson');
        excludeKeys.add('vieilours');
    }
    return excludeKeys;
};

export const getRandomCharacters = (count = 3) => {
    const available = Object.entries(portraits)
        .filter(([path]) => {
            // Filter out Reine and Roi
            // User requested exclusion of LEADER-Reine.tif and LEADER-Roi.tiff
            // Actual files are LEADERS-Reine.tif and LEADERS-Roi.tif
            return !path.includes('LEADERS-Reine.tif') && !path.includes('LEADERS-Roi.tif');
        })
        .map(([path, url]) => ({ path, url, key: extractKeyFromPortraitPath(path) }))
        .filter(({ key }) => !NON_DRAFTABLE_KEYS.has(key))
        .map(({ url }) => url)
        .filter(url => url); // Ensure no null/undefined values

    console.log(`Found ${available.length} characters available for randomization.`);

    // Fisher-Yates Shuffle
    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }

    // Ensure we don't return nulls even if requested count is larger than available
    const result = available.slice(0, count);
    
    // Double check for any nulls (paranoid check)
    if (result.some(r => !r)) {
        console.warn("Randomizer found null values, retrying shuffle...");
        return getRandomCharacters(count); // Recursive retry
    }

    return result;
};

export const getUniqueRandomCharacter = (excludeList = []) => {
    const excludeKeys = expandDualExcludeKeys(
        new Set(excludeList.map((url) => urlToKey.get(url)).filter(Boolean))
    );

    const available = portraitEntries
        .filter(({ path, key }) => {
            if (path.includes('LEADERS-Reine.tif') || path.includes('LEADERS-Roi.tif')) return false;
            if (NON_DRAFTABLE_KEYS.has(key)) return false;
            if (excludeKeys.has(key)) return false;
            return true;
        })
        .map(({ url }) => url)
        .filter(url => url);

    if (available.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
};
