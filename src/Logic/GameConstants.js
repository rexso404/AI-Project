import gameData from '../../data.json';

// Board & Background Assets
import boardImg from '../assets/board/Leaders_Board.png';
import bgImg from '../assets/background/bg.jpg';
import blankCardImg from '../assets/Blank/blank.png';

// Leader Assets
import whiteReine from '../assets/leader_blanc/Leaders_BGA_white_LeaderReine.png';
import whiteRoi from '../assets/leader_blanc/Leaders_BGA_white_LeaderRoi.png';
import blackReine from '../assets/leader_noir/Leaders_BGA_black_LeaderReine.png';
import blackRoi from '../assets/leader_noir/Leaders_BGA_black_LeaderRoi.png';

// Hand Assets
import reinePortrait from '../assets/Q&K_Potrait/LEADERS-Reine.tif?url';
import roiPortrait from '../assets/Q&K_Potrait/LEADERS-Roi.tif?url';

// Character Portrait Assets
import hermitPortrait from '../assets/character_portrait/LEADERS-MaitreDesBetes.tif?url';

// Character assets (white)
import whiteAcrobate from '../assets/character_blanc/Leaders_BGA_white_Acrobate.png';
import whiteArchere from '../assets/character_blanc/Leaders_BGA_white_Archere.png';
import whiteAssassin from '../assets/character_blanc/Leaders_BGA_white_Assassin.png';
import whiteCavalier from '../assets/character_blanc/Leaders_BGA_white_Cavalier.png';
import whiteCogneur from '../assets/character_blanc/Leaders_BGA_white_Cogneur.png';
import whiteGardeRoyal from '../assets/character_blanc/Leaders_BGA_white_GardeRoyal.png';
import whiteGeolier from '../assets/character_blanc/Leaders_BGA_white_Geolier.png';
import whiteIllusionniste from '../assets/character_blanc/Leaders_BGA_white_Illusionniste.png';
import whiteLanceGrappin from '../assets/character_blanc/Leaders_BGA_white_LanceGrappin.png';
import whiteManipulatrice from '../assets/character_blanc/Leaders_BGA_white_Manipulatrice.png';
import whiteNemesis from '../assets/character_blanc/Leaders_BGA_white_Nemesis.png';
import whiteOurson from '../assets/character_blanc/Leaders_BGA_white_Ourson.png';
import whiteProtecteur from '../assets/character_blanc/Leaders_BGA_white_Protecteur.png';
import whiteRodeuse from '../assets/character_blanc/Leaders_BGA_white_Rodeuse.png';
import whiteTavernier from '../assets/character_blanc/Leaders_BGA_white_Tavernier.png';
import whiteVieilOurs from '../assets/character_blanc/Leaders_BGA_white_VieilOurs.png';
import whiteVizir from '../assets/character_blanc/Leaders_BGA_white_Vizir.png';

// Character assets (black)
import blackAcrobate from '../assets/character_noir/Leaders_BGA_black_Acrobate.png';
import blackArchere from '../assets/character_noir/Leaders_BGA_black_Archere.png';
import blackAssassin from '../assets/character_noir/Leaders_BGA_black_Assassin.png';
import blackCavalier from '../assets/character_noir/Leaders_BGA_black_Cavalier.png';
import blackCogneur from '../assets/character_noir/Leaders_BGA_black_Cogneur.png';
import blackGardeRoyal from '../assets/character_noir/Leaders_BGA_black_GardeRoyal.png';
import blackGeolier from '../assets/character_noir/Leaders_BGA_black_Geolier.png';
import blackIllusionniste from '../assets/character_noir/Leaders_BGA_black_Illusionniste.png';
import blackLanceGrappin from '../assets/character_noir/Leaders_BGA_black_LanceGrappin.png';
import blackManipulatrice from '../assets/character_noir/Leaders_BGA_black_Manipulatrice.png';
import blackNemesis from '../assets/character_noir/Leaders_BGA_black_Nemesis.png';
import blackOurson from '../assets/character_noir/Leaders_BGA_black_Ourson.png';
import blackProtecteur from '../assets/character_noir/Leaders_BGA_black_Protecteur.png';
import blackRodeuse from '../assets/character_noir/Leaders_BGA_black_Rodeuse.png';
import blackTavernier from '../assets/character_noir/Leaders_BGA_black_Tavernier.png';
import blackVieilOurs from '../assets/character_noir/Leaders_BGA_black_VieilOurs.png';
import blackVizir from '../assets/character_noir/Leaders_BGA_black_Vizir.png';

export {
    whiteReine, whiteRoi, blackReine, blackRoi,
    reinePortrait, roiPortrait,
  hermitPortrait,
    boardImg, bgImg, blankCardImg
};

export const WHITE_CHARACTER_MAP = {
  acrobate: whiteAcrobate,
  archere: whiteArchere,
  assassin: whiteAssassin,
  cavalier: whiteCavalier,
  cogneur: whiteCogneur,
  garderoyal: whiteGardeRoyal,
  geolier: whiteGeolier,
  illusionniste: whiteIllusionniste,
  lancegrappin: whiteLanceGrappin,
  manipulatrice: whiteManipulatrice,
  nemesis: whiteNemesis,
  ourson: whiteOurson,
  protecteur: whiteProtecteur,
  rodeuse: whiteRodeuse,
  tavernier: whiteTavernier,
  vieilours: whiteVieilOurs,
  vizir: whiteVizir,
};

export const BLACK_CHARACTER_MAP = {
  acrobate: blackAcrobate,
  archere: blackArchere,
  assassin: blackAssassin,
  cavalier: blackCavalier,
  cogneur: blackCogneur,
  garderoyal: blackGardeRoyal,
  geolier: blackGeolier,
  illusionniste: blackIllusionniste,
  lancegrappin: blackLanceGrappin,
  manipulatrice: blackManipulatrice,
  nemesis: blackNemesis,
  ourson: blackOurson,
  protecteur: blackProtecteur,
  rodeuse: blackRodeuse,
  tavernier: blackTavernier,
  vieilours: blackVieilOurs,
  vizir: blackVizir,
};

export const BOARD_IMAGE_ALIAS_MAP = Object.entries({
  ...WHITE_CHARACTER_MAP,
  ...BLACK_CHARACTER_MAP,
}).reduce((acc, [alias, asset]) => {
  acc[asset] = alias;
  return acc;
}, {});

export const DUAL_CARD_KEYS = new Set(['ourson', 'vieilours']);
export const DUAL_TOKEN_SEQUENCE = ['hermit', 'cub'];
export const DUAL_TOKEN_ASSETS = {
  p1: {
    hermit: whiteVieilOurs,
    cub: whiteOurson,
  },
  p2: {
    hermit: blackVieilOurs,
    cub: blackOurson,
  },
};

export const FLOAT_TOLERANCE = 0.001;
export const BOARD_COMPATIBLE_KEYS = new Set([
  ...Object.keys(WHITE_CHARACTER_MAP),
  ...Object.keys(BLACK_CHARACTER_MAP),
]);
export const IMPLEMENTED_ACTIVE_ABILITIES = new Set([
  'acrobate',
  'cavalier',
  'manipulatrice',
  'garderoyal',
  'lancegrappin',
  'tavernier',
  'cogneur',
  'illusionniste',
  'rodeuse',
]);

export const MAX_DECK_SIZE = 4;
export const DECK_INDEXES = Array.from({ length: MAX_DECK_SIZE }, (_, idx) => idx);
export const STORAGE_KEY = 'leaders-game-state';

export const LEADER_DISPLAY_NAMES = {
  reine: 'Reine',
  roi: 'Roi',
};

export const CHARACTER_ALIAS_MAP = {
  acrobate: 'Acrobat',
  archere: 'Archer',
  assassin: 'Assassin',
  cavalier: 'Rider',
  cogneur: 'Bruiser',
  garderoyal: 'Royal Guard',
  geolier: 'Jailer',
  illusionniste: 'Illusionist',
  lancegrappin: 'Claw Launcher',
  manipulatrice: 'Manipulator',
  nemesis: 'Nemesis',
  ourson: 'Hermit and Cub',
  vieilours: 'Hermit and Cub',
  protecteur: 'Protector',
  rodeuse: 'Wanderer',
  tavernier: 'Brewmaster',
  vizir: 'Vizier',
};

const normalizeKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const CHARACTER_DATA_MAP = gameData.characters.reduce((acc, character) => {
  const key = normalizeKey(character.name);
  if (key) acc[key] = character;
  return acc;
}, {});
