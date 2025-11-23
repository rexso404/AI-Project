export const BOARD_STRUCTURE = [
  { col: 0, count: 4 },
  { col: 1, count: 5 },
  { col: 2, count: 6 },
  { col: 3, count: 7 },
  { col: 4, count: 6 },
  { col: 5, count: 5 },
  { col: 6, count: 4 },
];

export const getBoardNodes = () => {
    const nodes = [];
    let id = 0;
    BOARD_STRUCTURE.forEach(({ col, count }) => {
        // Max count is 7.
        // Center is 3.
        const startOffset = (7 - count) / 2; 
        
        for (let i = 0; i < count; i++) {
            nodes.push({
                id: id++,
                col: col,
                row: i,
                x: col,
                y: i + startOffset
            });
        }
    });
    return nodes;
};
