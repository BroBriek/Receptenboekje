'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads/stock');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const STOCK_IMAGES = [
  // Pasta & Italiaans
  {
    id: 'pasta-carbonara',
    filename: 'stock/pasta-carbonara.jpg',
    title: 'Romige Pasta Carbonara',
    category: 'pasta',
    categoryName: 'Pasta & Italiaans',
    tags: ['pasta', 'spaghetti', 'italiaans', 'romig', 'spek'],
    url: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'pizza-margherita',
    filename: 'stock/pizza-margherita.jpg',
    title: 'Klassieke Pizza Margherita',
    category: 'pasta',
    categoryName: 'Pasta & Italiaans',
    tags: ['pizza', 'kaas', 'italiaans', 'tomaat', 'mozzarella'],
    url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'lasagne-bolognese',
    filename: 'stock/lasagne-bolognese.jpg',
    title: 'Huisgemaakte Lasagne',
    category: 'pasta',
    categoryName: 'Pasta & Italiaans',
    tags: ['lasagne', 'pasta', 'gehakt', 'oven', 'kaas'],
    url: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'penne-arrabbiata',
    filename: 'stock/penne-arrabbiata.jpg',
    title: 'Penne Arrabbiata',
    category: 'pasta',
    categoryName: 'Pasta & Italiaans',
    tags: ['pasta', 'penne', 'pittig', 'tomatensaus', 'vegan'],
    url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80'
  },

  // Burgers & BBQ
  {
    id: 'classic-cheeseburger',
    filename: 'stock/classic-cheeseburger.jpg',
    title: 'Klassieke Cheeseburger',
    category: 'burgers',
    categoryName: 'Burgers & BBQ',
    tags: ['burger', 'rundvlees', 'kaas', 'friet', 'fastfood'],
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'bbq-bacon-burger',
    filename: 'stock/bbq-bacon-burger.jpg',
    title: 'BBQ Bacon Burger',
    category: 'burgers',
    categoryName: 'Burgers & BBQ',
    tags: ['burger', 'bbq', 'spek', 'vlees', 'grill'],
    url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'gegrilde-bbq-ribs',
    filename: 'stock/gegrilde-bbq-ribs.jpg',
    title: 'Malse BBQ Spareribs',
    category: 'burgers',
    categoryName: 'Burgers & BBQ',
    tags: ['spareribs', 'bbq', 'vlees', 'grill', 'ribs'],
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80'
  },

  // Salades & Groenten
  {
    id: 'caesar-salade',
    filename: 'stock/caesar-salade.jpg',
    title: 'Klassieke Caesar Salade',
    category: 'salades',
    categoryName: 'Salades & Groenten',
    tags: ['salade', 'kip', 'croutons', 'parmesan', 'gezond'],
    url: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'griekse-salade',
    filename: 'stock/griekse-salade.jpg',
    title: 'Griekse Salade met Feta',
    category: 'salades',
    categoryName: 'Salades & Groenten',
    tags: ['salade', 'feta', 'olijven', 'komkommer', 'mediterraans'],
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'buddha-bowl',
    filename: 'stock/buddha-bowl.jpg',
    title: 'Kleurrijke Buddha Bowl',
    category: 'salades',
    categoryName: 'Salades & Groenten',
    tags: ['bowl', 'vegetarisch', 'avocado', 'quinoa', 'gezond'],
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'geroosterde-groenten',
    filename: 'stock/geroosterde-groenten.jpg',
    title: 'Geroosterde Groenten',
    category: 'salades',
    categoryName: 'Salades & Groenten',
    tags: ['groenten', 'oven', 'gezond', 'vegan', 'bijgerecht'],
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80'
  },

  // Soepen & Stoofschotels
  {
    id: 'tomatensoep-basilicum',
    filename: 'stock/tomatensoep-basilicum.jpg',
    title: 'Verse Tomatensoep',
    category: 'soepen',
    categoryName: 'Soepen & Stoofpotten',
    tags: ['soep', 'tomaat', 'basilicum', 'warm', 'vegetarisch'],
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'romige-pompoensoep',
    filename: 'stock/romige-pompoensoep.jpg',
    title: 'Romige Pompoensoep',
    category: 'soepen',
    categoryName: 'Soepen & Stoofpotten',
    tags: ['soep', 'pompoen', 'romig', 'herfst', 'gezond'],
    url: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'indiase-curry',
    filename: 'stock/indiase-curry.jpg',
    title: 'Kruidige Kip Curry',
    category: 'soepen',
    categoryName: 'Soepen & Stoofpotten',
    tags: ['curry', 'kip', 'rijst', 'naan', 'pittig', 'indiase'],
    url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80'
  },

  // Ontbijt & Lunch
  {
    id: 'fluffy-pannenkoeken',
    filename: 'stock/fluffy-pannenkoeken.jpg',
    title: 'Fluffy Pancakes met Bessen',
    category: 'ontbijt',
    categoryName: 'Ontbijt & Lunch',
    tags: ['pannenkoeken', 'stroop', 'bessen', 'ontbijt', 'zoet'],
    url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'avocado-toast-ei',
    filename: 'stock/avocado-toast-ei.jpg',
    title: 'Avocadotoast met Gekookt Ei',
    category: 'ontbijt',
    categoryName: 'Ontbijt & Lunch',
    tags: ['avocado', 'toast', 'ei', 'ontbijt', 'lunch'],
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'verse-croissants',
    filename: 'stock/verse-croissants.jpg',
    title: 'Verse Franse Croissants',
    category: 'ontbijt',
    categoryName: 'Ontbijt & Lunch',
    tags: ['croissant', 'ontbijt', 'koffie', 'gebak', 'frans'],
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80'
  },

  // Aziatisch & Noodles
  {
    id: 'sushi-maki-combo',
    filename: 'stock/sushi-maki-combo.jpg',
    title: 'Verse Sushi Mix',
    category: 'aziatisch',
    categoryName: 'Aziatisch & Sushi',
    tags: ['sushi', 'zalm', 'tonijn', 'aziatisch', 'japan'],
    url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'japanse-ramen-soep',
    filename: 'stock/japanse-ramen-soep.jpg',
    title: 'Japanse Ramen Soep',
    category: 'aziatisch',
    categoryName: 'Aziatisch & Sushi',
    tags: ['ramen', 'noodles', 'soep', 'ei', 'aziatisch'],
    url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'noodle-stirfry',
    filename: 'stock/noodle-stirfry.jpg',
    title: 'Wok Noodlemix',
    category: 'aziatisch',
    categoryName: 'Aziatisch & Sushi',
    tags: ['wok', 'noodles', 'stirfry', 'groenten', 'aziatisch'],
    url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'pokebowl-zalm',
    filename: 'stock/pokebowl-zalm.jpg',
    title: 'Poke Bowl met Zalm & Avocado',
    category: 'aziatisch',
    categoryName: 'Aziatisch & Sushi',
    tags: ['pokebowl', 'zalm', 'rijst', 'avocado', 'gezond'],
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
  },

  // Vis & Zeevruchten
  {
    id: 'gegrilde-zalmfilet',
    filename: 'stock/gegrilde-zalmfilet.jpg',
    title: 'Gegrilde Zalmfilet',
    category: 'vis',
    categoryName: 'Vis & Zeevruchten',
    tags: ['zalm', 'vis', 'gegrild', 'citroen', 'gezond'],
    url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'knoflook-garnalen',
    filename: 'stock/knoflook-garnalen.jpg',
    title: 'Gebakken Knoflookgarnalen',
    category: 'vis',
    categoryName: 'Vis & Zeevruchten',
    tags: ['garnalen', 'zeevruchten', 'knoflook', 'tapas', 'vis'],
    url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'spaanse-paella',
    filename: 'stock/spaanse-paella.jpg',
    title: 'Spaanse Zeevruchten Paella',
    category: 'vis',
    categoryName: 'Vis & Zeevruchten',
    tags: ['paella', 'zeevruchten', 'rijst', 'spanje', 'vis'],
    url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80'
  },

  // Desserts & Gebak
  {
    id: 'chocoladetaart',
    filename: 'stock/chocoladetaart.jpg',
    title: 'Rijke Chocoladetaart',
    category: 'desserts',
    categoryName: 'Desserts & Gebak',
    tags: ['chocolade', 'taart', 'dessert', 'gebak', 'zoet'],
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'ambachtelijk-ijs',
    filename: 'stock/ambachtelijk-ijs.jpg',
    title: 'Ambachtelijk Bollen IJs',
    category: 'desserts',
    categoryName: 'Desserts & Gebak',
    tags: ['ijs', 'dessert', 'fruit', 'zoet', 'zomer'],
    url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'vers-fruit-tartaartje',
    filename: 'stock/vers-fruit-tartaartje.jpg',
    title: 'Fruit Tartaartje met Bessen',
    category: 'desserts',
    categoryName: 'Desserts & Gebak',
    tags: ['fruit', 'taart', 'gebak', 'bessen', 'dessert'],
    url: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'chocolade-brownies',
    filename: 'stock/chocolade-brownies.jpg',
    title: 'Smeuïge Chocolade Brownies',
    category: 'desserts',
    categoryName: 'Desserts & Gebak',
    tags: ['brownie', 'chocolade', 'gebak', 'snack', 'zoet'],
    url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80'
  },

  // Mexicaans & Wraps
  {
    id: 'mexicaanse-tacos',
    filename: 'stock/mexicaanse-tacos.jpg',
    title: "Mexicaanse Taco's",
    category: 'mexicaans',
    categoryName: 'Mexicaans & Wraps',
    tags: ['taco', 'mexicaans', 'guacamole', 'wraps', 'pittig'],
    url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'loaded-nachos',
    filename: 'stock/loaded-nachos.jpg',
    title: "Loaded Nacho's met Smeltkaas",
    category: 'mexicaans',
    categoryName: 'Mexicaans & Wraps',
    tags: ['nachos', 'kaas', 'guacamole', 'mexicaans', 'snack'],
    url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'kip-wrap',
    filename: 'stock/kip-wrap.jpg',
    title: 'Gevulde Kip Wrap',
    category: 'mexicaans',
    categoryName: 'Mexicaans & Wraps',
    tags: ['wrap', 'kip', 'salade', 'lunch', 'gezond'],
    url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80'
  },

  // Dranken & Smoothies
  {
    id: 'bessen-smoothie',
    filename: 'stock/bessen-smoothie.jpg',
    title: 'Verse Bessen Smoothie',
    category: 'dranken',
    categoryName: 'Dranken & Smoothies',
    tags: ['smoothie', 'bessen', 'fruit', 'ontbijt', 'drinken'],
    url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'verse-jus-d-orange',
    filename: 'stock/verse-jus-d-orange.jpg',
    title: 'Verse Sinaasappelsap',
    category: 'dranken',
    categoryName: 'Dranken & Smoothies',
    tags: ['jus', 'sinaasappel', 'drinken', 'ontbijt', 'vers'],
    url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'cappuccino-koffie',
    filename: 'stock/cappuccino-koffie.jpg',
    title: 'Klassieke Cappuccino',
    category: 'dranken',
    categoryName: 'Dranken & Smoothies',
    tags: ['koffie', 'cappuccino', 'ontbijt', 'dranken', 'warm'],
    url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&auto=format&fit=crop&q=80'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (reqUrl) => {
      https.get(reqUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download ${url}: Status ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function main() {
  console.log('Downloading stock food images...');
  const validImages = [];
  for (const item of STOCK_IMAGES) {
    const basename = path.basename(item.filename);
    const dest = path.join(UPLOADS_DIR, basename);
    console.log(`Downloading: ${item.title} -> ${basename}`);
    try {
      await downloadFile(item.url, dest);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        validImages.push(item);
      }
    } catch (err) {
      console.error(`Error downloading ${item.title}:`, err.message);
      if (fs.existsSync(dest) && fs.statSync(dest).size === 0) {
        fs.unlinkSync(dest);
      }
    }
  }

  // Write manifest with valid images only
  const manifestPath = path.join(UPLOADS_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(validImages, null, 2), 'utf-8');
  console.log(`Manifest written to ${manifestPath} (${validImages.length} images)`);
  console.log('Finished downloading stock images!');
}

main();
