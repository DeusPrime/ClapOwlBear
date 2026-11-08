import { createLucideIcon } from 'lucide-react';

const PlayingCardsIcon = createLucideIcon('PlayingCards', [
  ['path', { d: 'M7 17 3 15.5a2 2 0 0 1-1.2-2.6L5.5 3a2 2 0 0 1 2.6-1.2L16 5', key: 'back-card' }],
  ['rect', { x: '7', y: '5', width: '15', height: '17', rx: '2', key: 'front-card' }],
  ['path', { d: 'M14.5 10c-1 1.5-3.5 2.8-3.5 4.3a2 2 0 0 0 3.5 1.2 2 2 0 0 0 3.5-1.2c0-1.5-2.5-2.8-3.5-4.3Z', key: 'spade' }],
  ['path', { d: 'M14.5 15.5V18m-1.5 0h3', key: 'stem' }],
]);

export default PlayingCardsIcon;
