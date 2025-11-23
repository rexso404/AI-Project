const portraits = import.meta.glob('../assets/character_portrait/*.{tif,tiff}', { eager: true, query: '?url', import: 'default' });

export const getRandomCharacters = (count = 3) => {
    const available = Object.entries(portraits)
        .filter(([path]) => {
            // Filter out Reine and Roi
            // User requested exclusion of LEADER-Reine.tif and LEADER-Roi.tiff
            // Actual files are LEADERS-Reine.tif and LEADERS-Roi.tif
            return !path.includes('LEADERS-Reine.tif') && !path.includes('LEADERS-Roi.tif');
        })
        .map(([, url]) => url)
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
    const available = Object.entries(portraits)
        .filter(([path]) => {
            return !path.includes('LEADERS-Reine.tif') && !path.includes('LEADERS-Roi.tif');
        })
        .map(([, url]) => url)
        .filter(url => url && !excludeList.includes(url));

    if (available.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
};
