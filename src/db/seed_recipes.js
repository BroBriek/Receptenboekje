'use strict';

/**
 * seed_recipes.js
 * Inserts 20 placeholder Dutch recipes into the database.
 * Safe to run multiple times — skips recipes that already exist by title.
 * Usage: node src/db/seed_recipes.js
 */

require('dotenv').config();
const crypto = require('crypto');
const db = require('./database');

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4());

function getOrCreateTag(name) {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO tags (name) VALUES (?)').run(name).lastInsertRowid;
}

function getOrCreateIngredient(name) {
  const existing = db.prepare('SELECT id FROM ingredients WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO ingredients (name) VALUES (?)').run(name).lastInsertRowid;
}

const user = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
if (!user) { console.error('No users found. Run migrations first.'); process.exit(1); }
const userId = user.id;

const recipes = [
  {
    title: 'Spaghetti Bolognese',
    description: 'Klassieke Italiaanse pasta met een rijke vleessaus van gehakt, tomaat en verse kruiden.',
    servings: 4, prep_time: 15, cook_time: 40,
    tags: ['Pasta', 'Italiaans', 'Vlees'],
    ingredients: [
      { name: 'Spaghetti', quantity: 400, unit: 'g' },
      { name: 'Rundergehakt', quantity: 500, unit: 'g' },
      { name: 'Tomatenpuree', quantity: 2, unit: 'el' },
      { name: 'Gepelde tomaten (blik)', quantity: 400, unit: 'g' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Knoflook', quantity: 2, unit: 'teentjes' },
      { name: 'Wortel', quantity: 1, unit: 'stuks' },
      { name: 'Olijfolie', quantity: 2, unit: 'el' },
      { name: 'Gedroogde oregano', quantity: 1, unit: 'tl' },
      { name: 'Parmezaanse kaas', quantity: 50, unit: 'g' },
    ],
    steps: [
      'Snipper de ui en wortel fijn en hak de knoflook.',
      'Verhit olijfolie en fruit de ui en wortel 5 minuten.',
      'Voeg knoflook toe, bak 1 minuut.',
      'Doe het gehakt erbij en bak bruin.',
      'Voeg tomatenpuree, tomaten en oregano toe. Laat 30 min sudderen.',
      'Kook spaghetti al dente. Serveer met de saus en Parmezaan.',
    ],
  },
  {
    title: 'Hollandse Erwtensoep',
    description: 'Dikke, voedzame erwtensoep met rookworst, selderij en spek.',
    servings: 6, prep_time: 20, cook_time: 90,
    tags: ['Soep', 'Hollands'],
    ingredients: [
      { name: 'Spliterwten', quantity: 500, unit: 'g' },
      { name: 'Rookworst', quantity: 300, unit: 'g' },
      { name: 'Gerookt spek', quantity: 150, unit: 'g' },
      { name: 'Prei', quantity: 2, unit: 'stuks' },
      { name: 'Selderijstengels', quantity: 3, unit: 'stuks' },
      { name: 'Aardappelen', quantity: 3, unit: 'stuks' },
      { name: 'Ui', quantity: 2, unit: 'stuks' },
      { name: 'Varkensbouillon', quantity: 1500, unit: 'ml' },
    ],
    steps: [
      'Spoel de spliterwten. Breng bouillon aan de kook met de erwten.',
      'Voeg spek, ui en selderij toe. Kook 45 min.',
      'Voeg prei, aardappelen en rookworst toe. Kook nog 30-45 min.',
      'Breng op smaak en serveer met roggebrood.',
    ],
  },
  {
    title: 'Kippensoep met Vermicelli',
    description: 'Heldere, verwarmende kippensoep met groenten en vermicelli.',
    servings: 4, prep_time: 15, cook_time: 60,
    tags: ['Soep', 'Kip'],
    ingredients: [
      { name: 'Kippenbouten', quantity: 2, unit: 'stuks' },
      { name: 'Vermicelli', quantity: 100, unit: 'g' },
      { name: 'Wortel', quantity: 2, unit: 'stuks' },
      { name: 'Prei', quantity: 1, unit: 'stuks' },
      { name: 'Selderij', quantity: 2, unit: 'stengels' },
      { name: 'Kipbouillonblokje', quantity: 2, unit: 'stuks' },
      { name: 'Peterselie', quantity: 1, unit: 'bosje' },
    ],
    steps: [
      'Kook kip 45 min in 1,5 liter water met bouillonblokjes.',
      'Haal kip eruit, pluk het vlees van het bot.',
      'Voeg groenten toe aan de bouillon, kook 10 min.',
      'Voeg vermicelli en kippenvlees toe, kook 5 min. Garneer met peterselie.',
    ],
  },
  {
    title: 'Lasagne',
    description: 'Romige lasagne met gehaktsaus, bechamelsaus en gesmolten mozzarella.',
    servings: 6, prep_time: 30, cook_time: 50,
    tags: ['Pasta', 'Italiaans', 'Ovengerecht', 'Vlees'],
    ingredients: [
      { name: 'Lasagnebladen', quantity: 250, unit: 'g' },
      { name: 'Rundergehakt', quantity: 500, unit: 'g' },
      { name: 'Gepelde tomaten (blik)', quantity: 400, unit: 'g' },
      { name: 'Mozzarella', quantity: 200, unit: 'g' },
      { name: 'Melk', quantity: 500, unit: 'ml' },
      { name: 'Boter', quantity: 40, unit: 'g' },
      { name: 'Bloem', quantity: 40, unit: 'g' },
      { name: 'Geraspte kaas', quantity: 100, unit: 'g' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
    ],
    steps: [
      'Bak gehakt met ui, voeg tomaten toe en laat 20 min sudderen.',
      'Maak bechamelsaus van boter, bloem en melk.',
      'Laag: gehaktsaus, lasagnebladen, bechamel. Herhaal. Eindig met kaas.',
      'Bak 40 min op 200 graden.',
    ],
  },
  {
    title: 'Nasi Goreng',
    description: 'Klassieke Indonesische gebakken rijst met kip, groenten en ei.',
    servings: 4, prep_time: 20, cook_time: 20,
    tags: ['Rijst', 'Aziatisch', 'Kip'],
    ingredients: [
      { name: 'Gekookte rijst', quantity: 600, unit: 'g' },
      { name: 'Kipfilet', quantity: 300, unit: 'g' },
      { name: 'Ei', quantity: 2, unit: 'stuks' },
      { name: 'Sojasaus', quantity: 3, unit: 'el' },
      { name: 'Sambal oelek', quantity: 1, unit: 'tl' },
      { name: 'Knoflook', quantity: 2, unit: 'teentjes' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Lente-ui', quantity: 3, unit: 'stuks' },
    ],
    steps: [
      'Bak ui en knoflook, voeg kip toe en gaar.',
      'Schuif opzij, roerbak de eieren los.',
      'Voeg rijst toe, roerbak alles. Breng op smaak met sojasaus en sambal.',
      'Serveer met lente-ui en atjar.',
    ],
  },
  {
    title: 'Gegrilde Zalm met Citroen-Dilleboter',
    description: 'Sappige zalm met een frisse citroen-dilleboter, perfect met aardappelen.',
    servings: 2, prep_time: 10, cook_time: 15,
    tags: ['Vis', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Zalmfilet', quantity: 2, unit: 'stuks' },
      { name: 'Citroen', quantity: 1, unit: 'stuks' },
      { name: 'Boter', quantity: 50, unit: 'g' },
      { name: 'Verse dille', quantity: 2, unit: 'el' },
      { name: 'Knoflook', quantity: 1, unit: 'teentje' },
      { name: 'Olijfolie', quantity: 1, unit: 'el' },
    ],
    steps: [
      'Meng boter met dille, knoflook en citroenrasp.',
      'Bestrijk zalm met olijfolie, peper en zout.',
      'Grill 4 min per kant. Leg de kruidenboter erop en serveer.',
    ],
  },
  {
    title: 'Vegetarische Kikkererwten Curry',
    description: 'Romige curry met kikkererwten, spinazie en kokosmelk.',
    servings: 4, prep_time: 10, cook_time: 25,
    tags: ['Vegetarisch', 'Aziatisch', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Kikkererwten (blik)', quantity: 400, unit: 'g' },
      { name: 'Spinazie', quantity: 200, unit: 'g' },
      { name: 'Kokosmelk', quantity: 400, unit: 'ml' },
      { name: 'Gepelde tomaten (blik)', quantity: 400, unit: 'g' },
      { name: 'Currypoeder', quantity: 2, unit: 'tl' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Knoflook', quantity: 2, unit: 'teentjes' },
      { name: 'Basmatirijst', quantity: 300, unit: 'g' },
    ],
    steps: [
      'Fruit ui, knoflook en curry. Voeg tomaten toe, 5 min inkoken.',
      'Voeg kokosmelk en kikkererwten toe, 15 min pruttelen.',
      'Roer spinazie erdoor. Serveer met basmatirijst.',
    ],
  },
  {
    title: 'Kip Tikka Masala',
    description: 'Malse kip in een rijke, romige tomatensaus met Indiase specerijen.',
    servings: 4, prep_time: 20, cook_time: 30,
    tags: ['Kip', 'Aziatisch'],
    ingredients: [
      { name: 'Kipfilet', quantity: 600, unit: 'g' },
      { name: 'Volle yoghurt', quantity: 150, unit: 'ml' },
      { name: 'Gepelde tomaten (blik)', quantity: 400, unit: 'g' },
      { name: 'Slagroom', quantity: 100, unit: 'ml' },
      { name: 'Tikka masalapoeder', quantity: 2, unit: 'el' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Knoflook', quantity: 3, unit: 'teentjes' },
      { name: 'Geraspte gember', quantity: 1, unit: 'el' },
      { name: 'Boter', quantity: 2, unit: 'el' },
    ],
    steps: [
      'Marineer kip in yoghurt en specerijen, minimaal 1 uur.',
      'Grill de kip tot gaar en lichtverkoold.',
      'Bak ui, knoflook en gember. Voeg specerijen en tomaten toe.',
      'Pureer de saus, voeg slagroom en kip toe. Sudder 10 min.',
    ],
  },
  {
    title: 'Caesar Salade met Kip',
    description: 'Knapperige romaine sla met gegrilde kip, Parmezaan en croutons.',
    servings: 2, prep_time: 15, cook_time: 15,
    tags: ['Salade', 'Kip', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Romaine sla', quantity: 1, unit: 'krop' },
      { name: 'Kipfilet', quantity: 300, unit: 'g' },
      { name: 'Parmezaanse kaas', quantity: 50, unit: 'g' },
      { name: 'Croutons', quantity: 100, unit: 'g' },
      { name: 'Caesar-dressing', quantity: 4, unit: 'el' },
    ],
    steps: [
      'Grill de kipfilet 6-7 min per kant. Snijd in plakjes.',
      'Schep sla met dressing. Verdeel over borden.',
      'Leg kip erop, bestrooi met Parmezaan en croutons.',
    ],
  },
  {
    title: 'Tortilla Wraps met Pulled Chicken',
    description: 'Zachte wraps gevuld met kruidige pulled chicken, avocado en salsa.',
    servings: 4, prep_time: 15, cook_time: 25,
    tags: ['Kip', 'Mexicaans'],
    ingredients: [
      { name: 'Kipfilet', quantity: 500, unit: 'g' },
      { name: 'Tortillawraps', quantity: 8, unit: 'stuks' },
      { name: 'Avocado', quantity: 2, unit: 'stuks' },
      { name: 'Zure room', quantity: 100, unit: 'ml' },
      { name: 'Tomatensalsa', quantity: 150, unit: 'ml' },
      { name: 'Geraspte kaas', quantity: 100, unit: 'g' },
      { name: 'Paprikapoeder', quantity: 1, unit: 'tl' },
      { name: 'Limoen', quantity: 1, unit: 'stuks' },
    ],
    steps: [
      'Kook kip met specerijen 20 min, trek vlees uit elkaar.',
      'Maak guacamole van avocado met limoensap.',
      'Beleg wraps met kip, guacamole, salsa, kaas en zure room. Oprollen.',
    ],
  },
  {
    title: 'Aardappelpuree Ovenschotel met Gehakt',
    description: 'Comfortfood: gehaktsaus met groenten, afgetopt met luchtige aardappelpuree.',
    servings: 4, prep_time: 20, cook_time: 35,
    tags: ['Ovengerecht', 'Vlees', 'Hollands', 'Kinderen'],
    ingredients: [
      { name: 'Rundergehakt', quantity: 400, unit: 'g' },
      { name: 'Aardappelen', quantity: 800, unit: 'g' },
      { name: 'Boter', quantity: 50, unit: 'g' },
      { name: 'Melk', quantity: 100, unit: 'ml' },
      { name: 'Geraspte kaas', quantity: 100, unit: 'g' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Wortel', quantity: 2, unit: 'stuks' },
      { name: 'Tomatenpuree', quantity: 2, unit: 'el' },
    ],
    steps: [
      'Stamp gekookte aardappelen met boter en melk.',
      'Bak gehakt met ui en wortel, voeg tomatenpuree toe.',
      'Verdeel gehakt in ovenschaal, puree erover, kaas erop.',
      'Bak 25 min op 200 graden.',
    ],
  },
  {
    title: 'Penne Arrabiata',
    description: 'Pittige Italiaanse tomatensaus met knoflook en chilipeper.',
    servings: 3, prep_time: 5, cook_time: 20,
    tags: ['Pasta', 'Italiaans', 'Vegetarisch', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Penne', quantity: 350, unit: 'g' },
      { name: 'Gepelde tomaten (blik)', quantity: 400, unit: 'g' },
      { name: 'Knoflook', quantity: 3, unit: 'teentjes' },
      { name: 'Gedroogde chilipeper', quantity: 1, unit: 'tl' },
      { name: 'Olijfolie', quantity: 3, unit: 'el' },
      { name: 'Verse basilicum', quantity: 1, unit: 'handjevol' },
    ],
    steps: [
      'Kook penne al dente.',
      'Bak knoflook en chili in olijfolie 1 min.',
      'Voeg tomaten toe, 15 min sudderen.',
      'Meng met pasta, garneer met basilicum.',
    ],
  },
  {
    title: 'Paddenstoelen Risotto',
    description: 'Romige Italiaanse risotto met wilde paddenstoelen, witte wijn en Parmezaan.',
    servings: 4, prep_time: 10, cook_time: 35,
    tags: ['Rijst', 'Vegetarisch', 'Italiaans'],
    ingredients: [
      { name: 'Arborio rijst', quantity: 300, unit: 'g' },
      { name: 'Gemengde paddenstoelen', quantity: 300, unit: 'g' },
      { name: 'Witte wijn', quantity: 100, unit: 'ml' },
      { name: 'Groentebouillon', quantity: 1000, unit: 'ml' },
      { name: 'Sjalot', quantity: 2, unit: 'stuks' },
      { name: 'Boter', quantity: 40, unit: 'g' },
      { name: 'Parmezaanse kaas', quantity: 60, unit: 'g' },
    ],
    steps: [
      'Bak sjalot en paddenstoelen in boter.',
      'Voeg rijst toe en bak 2 min. Blus met wijn.',
      'Voeg lepel voor lepel warme bouillon toe, roer steeds (20 min).',
      'Roer Parmezaan en boter erdoor. Breng op smaak.',
    ],
  },
  {
    title: "Taco's met Gekruid Gehakt",
    description: "Knapperige taco's met pittig rundergehakt en verse toppings.",
    servings: 4, prep_time: 10, cook_time: 15,
    tags: ['Mexicaans', 'Vlees', 'Snel & Makkelijk', 'Kinderen'],
    ingredients: [
      { name: 'Rundergehakt', quantity: 400, unit: 'g' },
      { name: 'Tacoschelpen', quantity: 12, unit: 'stuks' },
      { name: 'Tacokruiden', quantity: 1, unit: 'zakje' },
      { name: 'IJsbergsla', quantity: 100, unit: 'g' },
      { name: 'Tomaat', quantity: 2, unit: 'stuks' },
      { name: 'Geraspte kaas', quantity: 100, unit: 'g' },
      { name: 'Zure room', quantity: 100, unit: 'ml' },
    ],
    steps: [
      'Bak gehakt bruin, voeg tacokruiden toe.',
      "Verwarm tacoschelpen in oven.",
      "Vul taco's met gehakt, sla, tomaat, kaas en zure room.",
    ],
  },
  {
    title: 'Aardappelsoep met Rookworst',
    description: 'Voedzame aardappelsoep met plakjes rookworst en bieslook.',
    servings: 4, prep_time: 15, cook_time: 30,
    tags: ['Soep', 'Hollands'],
    ingredients: [
      { name: 'Aardappelen', quantity: 600, unit: 'g' },
      { name: 'Rookworst', quantity: 200, unit: 'g' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Kipbouillon', quantity: 1000, unit: 'ml' },
      { name: 'Slagroom', quantity: 100, unit: 'ml' },
      { name: 'Bieslook', quantity: 1, unit: 'bosje' },
    ],
    steps: [
      'Fruit ui, voeg aardappelblokjes en bouillon toe, kook 20 min.',
      'Pureer de soep, roer slagroom erdoor.',
      'Serveer met rookworstplakjes en bieslook.',
    ],
  },
  {
    title: 'Bloemkoolschotel met Kaassaus',
    description: 'Bloemkool in een rijke kaassaus, goudbruin uit de oven.',
    servings: 4, prep_time: 15, cook_time: 30,
    tags: ['Vegetarisch', 'Ovengerecht', 'Hollands'],
    ingredients: [
      { name: 'Bloemkool', quantity: 1, unit: 'stuks' },
      { name: 'Belegen kaas (geraspt)', quantity: 150, unit: 'g' },
      { name: 'Boter', quantity: 30, unit: 'g' },
      { name: 'Bloem', quantity: 30, unit: 'g' },
      { name: 'Melk', quantity: 400, unit: 'ml' },
      { name: 'Nootmuskaat', quantity: 1, unit: 'mespunt' },
    ],
    steps: [
      'Kook bloemkoolroosjes 5 min voor.',
      'Maak kaassaus van boter, bloem, melk en kaas.',
      'Leg bloemkool in ovenschaal, schenk saus erover, bestrooi met kaas.',
      'Bak 25 min op 200 graden.',
    ],
  },
  {
    title: 'Garnalen Pad Thai',
    description: 'Thaise noedelschotel met garnalen, ei en tamarindesaus.',
    servings: 2, prep_time: 15, cook_time: 15,
    tags: ['Aziatisch', 'Vis', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Rijstnoedels', quantity: 200, unit: 'g' },
      { name: 'Garnalen', quantity: 200, unit: 'g' },
      { name: 'Ei', quantity: 2, unit: 'stuks' },
      { name: 'Taugé', quantity: 100, unit: 'g' },
      { name: 'Lente-ui', quantity: 3, unit: 'stuks' },
      { name: 'Vissaus', quantity: 2, unit: 'el' },
      { name: 'Tamarindesaus', quantity: 2, unit: 'el' },
      { name: 'Gehakte pindas', quantity: 30, unit: 'g' },
      { name: 'Limoen', quantity: 1, unit: 'stuks' },
    ],
    steps: [
      'Week rijstnoedels 20 min, giet af.',
      'Bak garnalen 2 min, haal eruit.',
      'Roerbak noedels, scramble eieren erbij.',
      'Voeg saus, taugé, garnalen en lente-ui toe. Serveer met pindas.',
    ],
  },
  {
    title: 'Bruschetta met Tomaat en Basilicum',
    description: 'Geroosterd brood met verse tomaten, basilicum en olijfolie.',
    servings: 4, prep_time: 10, cook_time: 5,
    tags: ['Vegetarisch', 'Italiaans', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Ciabatta', quantity: 1, unit: 'stuks' },
      { name: 'Rijpe tomaten', quantity: 4, unit: 'stuks' },
      { name: 'Verse basilicum', quantity: 1, unit: 'handjevol' },
      { name: 'Knoflook', quantity: 2, unit: 'teentjes' },
      { name: 'Olijfolie (extra vergine)', quantity: 3, unit: 'el' },
      { name: 'Balsamicoazijn', quantity: 1, unit: 'tl' },
    ],
    steps: [
      'Rooster ciabattaplakken.',
      'Meng tomaat met basilicum, olijfolie en azijn.',
      'Wrijf brood in met knoflook, beleg met tomatenmengsel.',
    ],
  },
  {
    title: 'Rode Bietensoep met Geitenkaas',
    description: 'Fluwelen bietensoep met dieprode kleur en romige geitenkaas.',
    servings: 4, prep_time: 15, cook_time: 40,
    tags: ['Soep', 'Vegetarisch'],
    ingredients: [
      { name: 'Gekookte rode bieten', quantity: 500, unit: 'g' },
      { name: 'Ui', quantity: 1, unit: 'stuks' },
      { name: 'Groentebouillon', quantity: 750, unit: 'ml' },
      { name: 'Appel', quantity: 1, unit: 'stuks' },
      { name: 'Zachte geitenkaas', quantity: 100, unit: 'g' },
      { name: 'Slagroom', quantity: 50, unit: 'ml' },
    ],
    steps: [
      'Fruit ui. Voeg bieten, appel en bouillon toe, 30 min koken.',
      'Pureer de soep glad.',
      'Serveer met slagroom en geitenkaas.',
    ],
  },
  {
    title: 'Pannenkoeken',
    description: 'Luchtige, goudgele Nederlandse pannenkoeken met stroop of suiker.',
    servings: 4, prep_time: 10, cook_time: 25,
    tags: ['Hollands', 'Vegetarisch', 'Kinderen', 'Bakken'],
    ingredients: [
      { name: 'Bloem', quantity: 250, unit: 'g' },
      { name: 'Melk', quantity: 500, unit: 'ml' },
      { name: 'Ei', quantity: 2, unit: 'stuks' },
      { name: 'Boter', quantity: 30, unit: 'g' },
      { name: 'Zout', quantity: 1, unit: 'mespunt' },
    ],
    steps: [
      'Meng bloem en zout, voeg eieren en melk toe tot glad beslag.',
      'Laat 15 min rusten.',
      'Bak in beboterde pan 2 min per kant. Serveer met stroop.',
    ],
  },
  {
    title: 'Wok Rundvlees met Broccoli',
    description: 'Snelle roerbak van mals rundvlees met broccoli in sojasaus.',
    servings: 3, prep_time: 15, cook_time: 15,
    tags: ['Aziatisch', 'Vlees', 'Snel & Makkelijk'],
    ingredients: [
      { name: 'Rundvlees roerbakstrips', quantity: 400, unit: 'g' },
      { name: 'Broccoli', quantity: 400, unit: 'g' },
      { name: 'Sojasaus', quantity: 3, unit: 'el' },
      { name: 'Oestersaus', quantity: 2, unit: 'el' },
      { name: 'Sesamolie', quantity: 1, unit: 'tl' },
      { name: 'Knoflook', quantity: 2, unit: 'teentjes' },
      { name: 'Maizena', quantity: 1, unit: 'el' },
      { name: 'Sesamzaad', quantity: 1, unit: 'el' },
    ],
    steps: [
      'Marineer vlees in sojasaus en maizena.',
      'Blancheer broccoli 2 min. Wok het vlees op hoog vuur.',
      'Voeg knoflook, broccoli, oestersaus en sesamolie toe. Serveer met rijst.',
    ],
  },
];

function detectTimerInText(text) {
  if (!text || typeof text !== 'string') return null;
  const minMatch = text.match(/(?:(\d+)\s*(?:-|tot|à)\s*)?(\d+(?:[.,]\d+)?)\s*(?:minuten|minuut|min\b|mins\b)/i);
  if (minMatch) {
    const minutes = parseFloat(minMatch[2].replace(',', '.'));
    if (!isNaN(minutes) && minutes > 0) return Math.round(minutes * 60);
  }
  const secMatch = text.match(/(?:(\d+)\s*(?:-|tot|à)\s*)?(\d+)\s*(?:seconden|seconde|sec\b)/i);
  if (secMatch) {
    const seconds = parseInt(secMatch[2], 10);
    if (!isNaN(seconds) && seconds > 0) return seconds;
  }
  const hrMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:uur|uren|hour|hours)/i);
  if (hrMatch) {
    const hours = parseFloat(hrMatch[1].replace(',', '.'));
    if (!isNaN(hours) && hours > 0) return Math.round(hours * 3600);
  }
  return null;
}

const insertRecipe = db.prepare(`INSERT INTO recipes (id, user_id, title, description, servings, prep_time, cook_time) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const insertRecipeTag = db.prepare(`INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)`);
const insertRecipeIngredient = db.prepare(`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
const insertStep = db.prepare(`INSERT INTO recipe_steps (recipe_id, step_number, instruction, timer_seconds) VALUES (?, ?, ?, ?)`);
const recipeExists = db.prepare('SELECT id FROM recipes WHERE title = ?');

const seedAll = db.transaction(() => {
  let added = 0, skipped = 0;
  for (const recipe of recipes) {
    if (recipeExists.get(recipe.title)) {
      console.log(`  Skipped (exists): ${recipe.title}`);
      skipped++;
      continue;
    }
    const recipeId = newId();
    insertRecipe.run(recipeId, userId, recipe.title, recipe.description, recipe.servings, recipe.prep_time, recipe.cook_time);
    for (const tagName of recipe.tags) insertRecipeTag.run(recipeId, getOrCreateTag(tagName));
    recipe.ingredients.forEach((ing, idx) => insertRecipeIngredient.run(recipeId, getOrCreateIngredient(ing.name), ing.quantity ?? null, ing.unit ?? null, ing.notes ?? null, idx));
    recipe.steps.forEach((instruction, idx) => insertStep.run(recipeId, idx + 1, instruction, detectTimerInText(instruction)));
    console.log(`  Added: ${recipe.title}`);
    added++;
  }
  return { added, skipped };
});

const { added, skipped } = seedAll();
console.log(`\nDone — ${added} recipes added, ${skipped} skipped.\n`);
