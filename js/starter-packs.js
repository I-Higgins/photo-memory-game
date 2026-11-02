// Built-in starter pictures (design/assets/starter-packs). Work with no photos.

const PACKS = [
  {
    id: 'boats-and-fishing', name: 'Boats & fishing',
    items: [['sailing-boat', 'Sailing boat'], ['tinny', 'Tinny'], ['fish', 'Fish'], ['lighthouse', 'Lighthouse'], ['anchor', 'Anchor'], ['crab', 'Crab'], ['buoy', 'Buoy'], ['seagull', 'Seagull'], ['fishing-rod', 'Fishing rod'], ['life-ring', 'Life ring']],
  },
  {
    id: 'cars', name: 'Cars',
    items: [['red-car', 'Red car'], ['ute', 'Ute'], ['old-roadster', 'Old roadster'], ['van', 'Van'], ['tractor', 'Tractor'], ['caravan', 'Caravan'], ['steering-wheel', 'Steering wheel'], ['petrol-pump', 'Petrol pump'], ['traffic-lights', 'Traffic lights'], ['wheel', 'Wheel']],
  },
  {
    id: 'animals', name: 'Animals',
    items: [['cat', 'Cat'], ['dog', 'Dog'], ['koala', 'Koala'], ['kookaburra', 'Kookaburra'], ['sheep', 'Sheep'], ['cow', 'Cow'], ['chicken', 'Chicken'], ['duck', 'Duck'], ['rabbit', 'Rabbit'], ['turtle', 'Turtle']],
  },
  {
    id: 'garden-and-flowers', name: 'Garden & flowers',
    items: [['sunflower', 'Sunflower'], ['rose', 'Rose'], ['tulip', 'Tulip'], ['watering-can', 'Watering can'], ['pot-plant', 'Pot plant'], ['bee', 'Bee'], ['butterfly', 'Butterfly'], ['ladybird', 'Ladybird'], ['apple-tree', 'Apple tree'], ['carrot', 'Carrot']],
  },
];

/** Cover picture per pack (the one drawn on the Home tile). */
const COVERS = { 'boats-and-fishing': 'sailing-boat', cars: 'red-car', animals: 'koala', 'garden-and-flowers': 'sunflower' };

export function packs() {
  return PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    cover: `assets/starter-packs/${p.id}/${COVERS[p.id]}.svg`,
    photos: p.items.map(([file, caption]) => ({
      id: `${p.id}/${file}`,
      caption,
      src: `assets/starter-packs/${p.id}/${file}.svg`,
    })),
  }));
}

export function getPack(id) {
  return packs().find((p) => p.id === id) || null;
}

/** Every starter-pack file, for the service-worker precache test. */
export function allPackFiles() {
  return PACKS.flatMap((p) => p.items.map(([file]) => `assets/starter-packs/${p.id}/${file}.svg`));
}
