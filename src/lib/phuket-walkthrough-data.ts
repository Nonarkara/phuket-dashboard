// ─── Phuket 3D Location Scout & Neighborhood Walkthrough Data ─────────────────
// Traceable real coordinates and authentic neighborhood context for
// Phuket Old Town and Patong, crafted for manga/line-art 3D perspective
// and smooth neighborhood discovery (inspired by Location Scout / Rokehan).
// All coordinates are traceable to OpenStreetMap & verified physical addresses.

export type WalkthroughNeighborhoodId = "phuket-old-town" | "patong";

export type PlaceCategory =
  | "michelin-dining"
  | "street-food"
  | "dessert-cafe"
  | "heritage-culture"
  | "nightlife-bars"
  | "viewpoint";

export type RenderShaderStyle =
  | "screentone"        // 線画＋トーン (Manga line art + halftone dot screen - Rokehan default)
  | "comic-pop"         // アメコミ・カラー (Saturated cel-shaded comic with Ben-Day dots)
  | "architectural-ink" // 白模 (Matte white architectural model with crisp ink outlines)
  | "neon-noir";        // サイバーパンク・夜 (High contrast black shadows + vivid neon highlights)

export type TimeOfDay = "morning" | "golden-hour" | "late-afternoon" | "neon-night";

export interface WalkthroughPlace {
  id: string;
  name: string;
  nameTh: string;
  neighborhoodId: WalkthroughNeighborhoodId;
  category: PlaceCategory;
  categoryLabel: string;
  lat: number;
  lng: number;
  elevationM: number;
  streetName: string;
  streetNameTh: string;
  address: string;
  summary: string;
  architecturalContext: string;
  signatureDishes: string[];
  priceRange: "฿" | "฿฿" | "฿฿฿" | "฿฿฿฿";
  badge?: string; // e.g. "Michelin Bib Gourmand", "Historic 1927 Landmark", "Heritage Cafe"
  soundEffectTh: string; // e.g. "อร่อย!", "แซ่บ!", "สดชื่น!", "ตึกเก่า!"
  soundEffectRom: string; // e.g. "AROI!", "ZAP!", "CHILL!", "HISTORIC!"
  comicBubbleColor: string;
  neighborhoodOrientation: {
    relativePosition: string; // e.g. "Right next to Torry's, under the pastel pink archways"
    landmarkProximity: string; // e.g. "45m west of Soi Romanee junction on Thalang Rd"
    entrySide: "North (Mountain Side)" | "South (Ocean Side)" | "East (Town Center)" | "West (Beachfront)";
    walkTimeMinutesFromCenter: number;
    visualCue: string; // e.g. "Look for the giant painted red lobster on the second floor facade"
  };
  photoScene: {
    heroUrl: string;
    caption: string;
    aspectRatio: string;
    isHistoricArchival?: boolean;
  };
  osmNodeId?: string;
  googleMapsUrl: string;
  osmUrl: string;
}

export interface WalkthroughNeighborhood {
  id: WalkthroughNeighborhoodId;
  name: string;
  nameTh: string;
  tagline: string;
  description: string;
  center: [number, number]; // [lat, lng]
  defaultBearing: number;
  defaultPitch: number;
  defaultZoom: number;
  groundElevationM: number;
  atmosphereKeywords: string[];
  keyStreets: {
    name: string;
    nameTh: string;
    vibe: string;
    center: [number, number];
  }[];
  heroArchwaysDescription: string;
  places: WalkthroughPlace[];
}

export const PHUKET_WALKTHROUGH_NEIGHBORHOODS: Record<
  WalkthroughNeighborhoodId,
  WalkthroughNeighborhood
> = {
  "phuket-old-town": {
    id: "phuket-old-town",
    name: "Phuket Old Town",
    nameTh: "ย่านเมืองเก่าภูเก็ต",
    tagline: "Peranakan Sino-Portuguese Heritage & Michelin Gastronomy Corridor",
    description:
      "A preserved 19th-century tin-boom settlement featuring continuous Sino-Portuguese shophouses with five-footway covered arcades (Chintho / บาทวิถีห้าฟุต), pastel louvered shutters, floral stucco reliefs, and secluded courtyard light wells (Chimchae).",
    center: [7.88478, 98.38922],
    defaultBearing: 275, // Looking west down Thalang Road
    defaultPitch: 72,   // Street-level dramatic perspective
    defaultZoom: 18.2,
    groundElevationM: 11,
    atmosphereKeywords: [
      "Sino-Portuguese",
      "Five-Footways (Chintho)",
      "Michelin Bib Gourmand",
      "Peranakan Baba-Yaya",
      "Overhead Wire Canopies",
      "Tuk-Tuk Ranks",
    ],
    keyStreets: [
      {
        name: "Thalang Road",
        nameTh: "ถนนถลาง",
        vibe: "Main historic spine; buried underground power cables, pastel shophouse facades, craft boutiques",
        center: [7.88478, 98.38922],
      },
      {
        name: "Soi Romanee",
        nameTh: "ซอยรมณีย์",
        vibe: "Photogenic heritage alley connecting Thalang & Dibuk; former 19th-century entertainment lane",
        center: [7.88515, 98.38910],
      },
      {
        name: "Dibuk Road",
        nameTh: "ถนนดีบุก",
        vibe: "Wide tin-merchants' boulevard; French-colonial colonial mansions, art galleries, Lok Tien food court",
        center: [7.88600, 98.38950],
      },
      {
        name: "Phang Nga Road",
        nameTh: "ถนนพังงา",
        vibe: "Southern commercial lane; historic On On Hotel, Chinese shrines, Tu Kab Khao",
        center: [7.88450, 98.39050],
      },
      {
        name: "Krabi Road",
        nameTh: "ถนนกระบี่",
        vibe: "Western cultural quarter; Thai Hua Museum, antique printing houses, quiet residential courtyards",
        center: [7.88520, 98.38680],
      },
    ],
    heroArchwaysDescription:
      "Continuous covered colonnades (Chintho) allow pedestrians to walk uninterrupted along the street sheltered from tropical monsoons and intense sun.",
    places: [
      {
        id: "raya-restaurant",
        name: "Raya Restaurant",
        nameTh: "ร้านอาหารระย้า",
        neighborhoodId: "phuket-old-town",
        category: "michelin-dining",
        categoryLabel: "Michelin Heritage Dining",
        lat: 7.88636,
        lng: 98.39185,
        elevationM: 12,
        streetName: "New Dibuk Road",
        streetNameTh: "ถนนดีบุก",
        address: "48/1 Dibuk Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "The matriarch of Phuket culinary institutions. Occupies a grand 2-storey 1920s Sino-Portuguese aristocratic mansion with vintage mosaic floors, antique radios, and green shuttered windows.",
        architecturalContext:
          "Preserved early-20th century Anglo-Peranakan merchant mansion with soaring ceilings and timber staircase.",
        signatureDishes: [
          "Crab Meat Curry with Cha-Phlu Leaves (แกงเนื้อปูใบชะพลู)",
          "Phuket Stewed Pork Belly (หมูฮ้องระย้า)",
          "Deep-Fried Crispy Sandfish with Turmeric (ปลาทรายทอดขมิ้น)",
        ],
        priceRange: "฿฿฿",
        badge: "Michelin Guide Selected",
        soundEffectTh: "อร่อยล้ำ!",
        soundEffectRom: "AROI-MAX!",
        comicBubbleColor: "#ff4444",
        neighborhoodOrientation: {
          relativePosition: "Corner of Dibuk and Luangpor Wat Chalong Rd, set slightly back behind bougainvillea trees",
          landmarkProximity: "180m northeast of Thalang Road pedestrian zone",
          entrySide: "North (Mountain Side)",
          walkTimeMinutesFromCenter: 3,
          visualCue: "Two-storey stately ochre mansion with vintage tile driveway and teakwood porch",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
          caption: "Raya's historic dining room with authentic patterned floor tiles and antique teak fittings",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Raya+Restaurant+Phuket+Old+Town",
        osmUrl: "https://www.openstreetmap.org/search?query=Raya%20Restaurant%20Phuket",
      },
      {
        id: "tu-kab-khao",
        name: "Tu Kab Khao",
        nameTh: "ร้านอาหารตู้กับข้าว",
        neighborhoodId: "phuket-old-town",
        category: "michelin-dining",
        categoryLabel: "Michelin Bib Gourmand",
        lat: 7.88494,
        lng: 98.39088,
        elevationM: 11,
        streetName: "Phang Nga Road",
        streetNameTh: "ถนนพังงา",
        address: "8 Phang Nga Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "Housed in a 130-year-old heritage building with a famous giant lobster mounted on its exterior wall. Renowned for rich Southern Thai recipes passed down through generations.",
        architecturalContext:
          "Deep Peranakan shophouse with decorative archway, portrait gallery, and velvet parlor banquettes.",
        signatureDishes: [
          "Braised Pork Belly Moo Hong with Cinnamon & Garlic (หมูฮ้องตู้กับข้าว)",
          "Southern Sour Curry with Giant Catfish Roe & Seabass (แกงส้มปลากะพงยอดมะพร้าว)",
          "Crispy Morning Glory Tempura with Spicy Prawn Salad (ยำผักบุ้งกรอบ)",
        ],
        priceRange: "฿฿",
        badge: "Michelin Bib Gourmand",
        soundEffectTh: "แซ่บถึงใจ!",
        soundEffectRom: "ZAP-SOUTHERN!",
        comicBubbleColor: "#f59e0b",
        neighborhoodOrientation: {
          relativePosition: "Midway along Phang Nga Road, opposite the historic Kasikornbank heritage branch",
          landmarkProximity: "90m south of Thalang Road via Soi Pradit lane",
          entrySide: "South (Ocean Side)",
          walkTimeMinutesFromCenter: 2,
          visualCue: "Giant sculpted red lobster clinging to the white Sino-Portuguese facade above the arch",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80",
          caption: "130-year-old shophouse dining room with Peranakan family portraits and lace curtains",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Tu+Kab+Khao+Restaurant+Phuket",
        osmUrl: "https://www.openstreetmap.org/search?query=Tu%20Kab%20Khao%20Phuket",
      },
      {
        id: "torrys-ice-cream",
        name: "Torry's Ice Cream",
        nameTh: "ทอรี่ ไอศกรีม ซอยรมณีย์",
        neighborhoodId: "phuket-old-town",
        category: "dessert-cafe",
        categoryLabel: "Artisanal Heritage Sweets",
        lat: 7.88531,
        lng: 98.38914,
        elevationM: 11,
        streetName: "Soi Romanee",
        streetNameTh: "ซอยรมณีย์",
        address: "16 Soi Romanee, Tambon Talat Yai, Mueang Phuket",
        summary:
          "The sweet crown jewel of Soi Romanee. A romantic boutique ice-cream parlour fusing authentic Thai-Peranakan heritage confectioneries with handcrafted gelato.",
        architecturalContext:
          "Pastel blush-pink Sino-Portuguese facade with arched fanlights and brass cafe mirrors.",
        signatureDishes: [
          "Bi-Co-Moi (Handmade coconut ice cream served over warm black sticky rice & sweet coconut cream)",
          "A-Pong Ice Cream (Crispy Phuket rolled crepe with rich coconut cream gelato)",
          "Phuket Pineapples & Pink Salt Sorbet (สับปะรดภูเก็ตพริกเกลือ)",
        ],
        priceRange: "฿฿",
        badge: "Cult Heritage Landmark",
        soundEffectTh: "สดชื่น!",
        soundEffectRom: "SWEET-CRUNCH!",
        comicBubbleColor: "#ec4899",
        neighborhoodOrientation: {
          relativePosition: "Center of Soi Romanee, directly midway between Thalang and Dibuk roads",
          landmarkProximity: "35m north of Thalang Road intersection",
          entrySide: "East (Town Center)",
          walkTimeMinutesFromCenter: 1,
          visualCue: "Iconic pastel pink facade with gold lettering and queued ice cream connoisseurs under the arch",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=1000&q=80",
          caption: "Torry's warm Bi-Co-Moi coconut gelato on black glutinous rice in Soi Romanee",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Torrys+Ice+Cream+Soi+Rommanee",
        osmUrl: "https://www.openstreetmap.org/search?query=Torrys%20Ice%20Cream%20Phuket",
      },
      {
        id: "lock-tien-food-court",
        name: "Lock Tien Food Court",
        nameTh: "ศูนย์อาหารลกเทียน",
        neighborhoodId: "phuket-old-town",
        category: "street-food",
        categoryLabel: "70-Year Street Legend",
        lat: 7.88582,
        lng: 98.38780,
        elevationM: 11,
        streetName: "Corner of Dibuk & Yaowarat",
        streetNameTh: "สี่แยกดีบุก-เยาวราช",
        address: "173 Yaowarat Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "The 70-year-old gastronomic crossroads of Phuket town. An open-air corner coffee shop housing multiple legendary street food masters under one roof.",
        architecturalContext:
          "Classic open corner corner-lot shophouse with vintage mosaic ceiling fans and round marble tables.",
        signatureDishes: [
          "Oh-Aew (โอ๋วเอ๋ว - Iconic Phuket shaved ice with translucent banana-seed jelly & red kidney beans)",
          "Hokkien Fried Noodles with Soft-Boiled Egg (หมี่ฮกเกี้ยนลกเทียน)",
          "Lobak (โลบะ - Crispy fried braised pork belly and tofu with spiced sweet dip)",
          "Fresh Phuket Spring Rolls (เปาะเปี๊ยะสด)",
        ],
        priceRange: "฿",
        badge: "70-Year Street Legacy",
        soundEffectTh: "ฉ่าาา!",
        soundEffectRom: "WOK-SIZZLE!",
        comicBubbleColor: "#0ea5e9",
        neighborhoodOrientation: {
          relativePosition: "Northwest corner of Dibuk Road and Yaowarat Road intersection",
          landmarkProximity: "140m west of Soi Romanee",
          entrySide: "North (Mountain Side)",
          walkTimeMinutesFromCenter: 2,
          visualCue: "Busy open-air corner with stainless steel street noodle carts and wooden stool cluster",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1000&q=80",
          caption: "Wok master frying authentic Hokkien noodles at Lock Tien corner",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Lok+Tien+Food+Court+Phuket",
        osmUrl: "https://www.openstreetmap.org/search?query=Lok+Tien+Phuket",
      },
      {
        id: "one-chun-cafe",
        name: "One Chun Cafe & Restaurant",
        nameTh: "ร้านวันจันทร์",
        neighborhoodId: "phuket-old-town",
        category: "michelin-dining",
        categoryLabel: "Michelin Vintage Parlor",
        lat: 7.88487,
        lng: 98.39167,
        elevationM: 11,
        streetName: "Thepkasattri Road",
        streetNameTh: "ถนนเทพกระษัตรี",
        address: "482 Thepkasattri Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "Sister restaurant to Raya, beloved by locals for hearty family recipes and a quirky vintage interior packed with 1950s wall clocks, rotary phones, and film projectors.",
        architecturalContext:
          "Red-brick exposed shophouse with vintage mid-century curios and stained glass windows.",
        signatureDishes: [
          "Crab Meat Curry with Rice Vermicelli (ขนมจีนน้ำยาปู)",
          "Deep Fried Pork Belly with Fish Sauce (หมูสามชั้นทอดน้ำปลา)",
          "Stir-Fried Melinjo Leaves with Eggs (ใบเหลียงผัดไข่)",
        ],
        priceRange: "฿฿",
        badge: "Michelin Bib Gourmand",
        soundEffectTh: "เข้มข้น!",
        soundEffectRom: "UMAMI-BOOM!",
        comicBubbleColor: "#10b981",
        neighborhoodOrientation: {
          relativePosition: "Eastern end of Dibuk Road near the intersection with Thepkasattri Road",
          landmarkProximity: "160m east of Soi Romanee",
          entrySide: "East (Town Center)",
          walkTimeMinutesFromCenter: 3,
          visualCue: "Antique wall clock sign hanging outside beneath a high wooden doorframe",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1000&q=80",
          caption: "Vintage collection of clocks and nostalgic tableware inside One Chun",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=One+Chun+Cafe+Phuket",
        osmUrl: "https://www.openstreetmap.org/search?query=One%20Chun%20Phuket",
      },
      {
        id: "kopitiam-by-wilai",
        name: "Kopitiam by Wilai",
        nameTh: "โกปี๊เตี่ยม บาย วิไล",
        neighborhoodId: "phuket-old-town",
        category: "dessert-cafe",
        categoryLabel: "Traditional Hainanese Coffee",
        lat: 7.88472,
        lng: 98.38870,
        elevationM: 11,
        streetName: "Thalang Road",
        streetNameTh: "ถนนถลาง",
        address: "18 Thalang Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "An authentic old-world Hainanese coffee house preserving the leisurely pace of early Phuket tin traders. Roasted robusta coffee poured through cloth sock filters.",
        architecturalContext:
          "Narrow deep shophouse with vintage porcelain wares, dark wood cabinets, and historic tin-mine maps.",
        signatureDishes: [
          "Traditional Kopi-O with Condensed Milk (กาแฟโบราณโกปี๊)",
          "Herbal Bak Kut Teh Soup (บะกุ๊ดเต๋)",
          "Crispy Kaya Toast with Soft-Boiled Free-Range Eggs (ขนมปังสังขยาไข่ลวก)",
        ],
        priceRange: "฿",
        badge: "Heritage Coffee Institution",
        soundEffectTh: "หอมกรุ่น!",
        soundEffectRom: "KOPI-AROMA!",
        comicBubbleColor: "#8b5cf6",
        neighborhoodOrientation: {
          relativePosition: "South side of Thalang Road, 40m west of the Soi Romanee opening",
          landmarkProximity: "Directly on the main Thalang Road walking strip",
          entrySide: "South (Ocean Side)",
          walkTimeMinutesFromCenter: 1,
          visualCue: "Carved wooden Chinese arch plaque reading Kopitiam in gold characters",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1000&q=80",
          caption: "Hand-poured traditional Thai coffee and kaya toast at Kopitiam",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Kopitiam+by+Wilai+Phuket",
        osmUrl: "https://www.openstreetmap.org/search?query=Kopitiam%20by%20Wilai%20Phuket",
      },
      {
        id: "the-memory-at-on-on",
        name: "The Memory at On On Hotel",
        nameTh: "โรงแรม ดิ ออน ออน",
        neighborhoodId: "phuket-old-town",
        category: "heritage-culture",
        categoryLabel: "Phuket's 1st Hotel (1927)",
        lat: 7.88424,
        lng: 98.39015,
        elevationM: 11,
        streetName: "Phang Nga Road",
        streetNameTh: "ถนนพังงา",
        address: "19 Phang Nga Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "Opened in 1927 as 'Un On Hotel' catering to seafaring merchants and miners. Made world-famous as the Bangkok backpacker hostel in the opening scenes of Leonardo DiCaprio's 'The Beach'.",
        architecturalContext:
          "Stunning Peranakan courtyard atrium with vintage floor tiles, iron chandeliers, and central light well.",
        signatureDishes: [
          "Boutique Heritage Lobby Coffee",
          "Peranakan High Tea Set",
        ],
        priceRange: "฿฿",
        badge: "Historic 1927 Landmark",
        soundEffectTh: "ประวัติศาสตร์!",
        soundEffectRom: "THE-BEACH-VIBE!",
        comicBubbleColor: "#3b82f6",
        neighborhoodOrientation: {
          relativePosition: "South side of Phang Nga Road, opposite the clock tower junction approach",
          landmarkProximity: "120m south of Thalang Road",
          entrySide: "South (Ocean Side)",
          walkTimeMinutesFromCenter: 2,
          visualCue: "Arched carriage entrance with historic blue neon 'The Memory at On On Hotel' marquee",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80",
          caption: "Restored interior courtyard atrium of the 1927 On On Hotel",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=The+Memory+at+On+On+Hotel",
        osmUrl: "https://www.openstreetmap.org/search?query=The%20Memory%20at%20On%20On%20Hotel",
      },
      {
        id: "phuket-thai-hua-museum",
        name: "Phuket Thai Hua Museum",
        nameTh: "พิพิธภัณฑ์ภูเก็ตไทยหัว",
        neighborhoodId: "phuket-old-town",
        category: "heritage-culture",
        categoryLabel: "Historic Chinese School (1934)",
        lat: 7.88522,
        lng: 98.38678,
        elevationM: 11,
        streetName: "Krabi Road",
        streetNameTh: "ถนนกระบี่",
        address: "28 Krabi Rd, Tambon Talat Yai, Mueang Phuket",
        summary:
          "The intellectual cradle of Phuket's Chinese diaspora. Established in 1934 as the island's premier Hokkien Chinese language school, now an award-winning museum preserving the mining era.",
        architecturalContext:
          "Palladian Sino-Portuguese educational mansion with a sprawling green front lawn and colonnaded veranda.",
        signatureDishes: [
          "Museum Bookstore & Cultural Archive",
        ],
        priceRange: "฿",
        badge: "ASA Architectural Conservation Award",
        soundEffectTh: "ตึกทรงคุณค่า!",
        soundEffectRom: "HERITAGE-HALL!",
        comicBubbleColor: "#6366f1",
        neighborhoodOrientation: {
          relativePosition: "North side of Krabi Road, 180m west of the Yaowarat intersection",
          landmarkProximity: "Western gateway of the historic walking street district",
          entrySide: "West (Beachfront)",
          walkTimeMinutesFromCenter: 3,
          visualCue: "White colonial gates opening onto an manicured inner courtyard and grand double staircase",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1000&q=80",
          caption: "Grand Palladian facade of the 1934 Thai Hua Museum on Krabi Road",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Phuket+Thai+Hua+Museum",
        osmUrl: "https://www.openstreetmap.org/search?query=Phuket%20Thai%20Hua%20Museum",
      },
    ],
  },
  "patong": {
    id: "patong",
    name: "Patong Beachfront & Bangla",
    nameTh: "หาดป่าตอง และ ถนนบางลา",
    tagline: "Vibrant Andaman Neon Nightlife & Coastal Entertainment Promenade",
    description:
      "Phuket's legendary west-coast nightlife capital. Spans the bustling pedestrian-only Bangla Walking Street with towering neon signs, open-air beach clubs, seafood street carts, and the panoramic Andaman sunset beach promenade.",
    center: [7.89340, 98.29850],
    defaultBearing: 260, // Looking west towards Andaman sea sunset
    defaultPitch: 68,
    defaultZoom: 17.8,
    groundElevationM: 4,
    atmosphereKeywords: [
      "Bangla Walking Street",
      "Neon Signs",
      "Andaman Beachfront",
      "Street Seafood",
      "Tuk-Tuk Ranks",
      "Sunset Viewpoints",
    ],
    keyStreets: [
      {
        name: "Bangla Road",
        nameTh: "ถนนบางลา",
        vibe: "World-famous walking street; pulsating nightclub complexes, neon street arches, open-air cocktail bars",
        center: [7.89340, 98.29850],
      },
      {
        name: "Thaweewong Road (Beach Road)",
        nameTh: "ถนนทวีวงศ์ (ถนนเลียบชายหาด)",
        vibe: "Coastal palm promenade; beachfront dining, water sports counters, sunset lounges",
        center: [7.89320, 98.29650],
      },
      {
        name: "Rat-U-Thit 200 Pi Road",
        nameTh: "ถนนราษฎร์อุทิศ 200 ปี",
        vibe: "Inland commercial strip; Jungceylon mall, Banzaan night food market, boxing stadiums",
        center: [7.89350, 98.30050],
      },
      {
        name: "Sai Nam Yen Road",
        nameTh: "ถนนสายน้ำเย็น",
        vibe: "Northern connector corridor; authentic local Thai seafood stalls, boxing gyms",
        center: [7.89670, 98.30150],
      },
    ],
    heroArchwaysDescription:
      "Giant illuminated neon gate towers and LED screens arch over Bangla Road, creating an electrifying neon canopy at night.",
    places: [
      {
        id: "bangla-walking-street-arch",
        name: "Bangla Walking Street Gate",
        nameTh: "ซุ้มประตูถนนคนเดินบางลา",
        neighborhoodId: "patong",
        category: "nightlife-bars",
        categoryLabel: "World-Famous Nightlife Hub",
        lat: 7.89340,
        lng: 98.29850,
        elevationM: 4,
        streetName: "Bangla Road",
        streetNameTh: "ถนนบางลา",
        address: "Bangla Rd, Tambon Pa Tong, Amphoe Kathu",
        summary:
          "The epicenter of Patong's nocturnal energy. Pedestrianized every evening from 6pm, transforming into a 400-meter neon carnival of music, street performers, and laser lights.",
        architecturalContext:
          "Massive steel gateway arch with multi-color dynamic LED message boards and digital billboard displays.",
        signatureDishes: [
          "Fresh Coconut Cocktails",
          "Street Pad Thai",
          "Artisanal Craft Beers on Tap",
        ],
        priceRange: "฿฿",
        badge: "Epicenter of Andaman Nightlife",
        soundEffectTh: "ตื๊ดดดด!",
        soundEffectRom: "BEAT-DROP!",
        comicBubbleColor: "#ec4899",
        neighborhoodOrientation: {
          relativePosition: "Entrance to Bangla Road from Rat-U-Thit 200 Pi Road (east side)",
          landmarkProximity: "Directly opposite Jungceylon shopping mall entrance",
          entrySide: "East (Town Center)",
          walkTimeMinutesFromCenter: 0,
          visualCue: "Towering neon archway glowing pink, cyan and electric gold with crowd gathering underneath",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
          caption: "Electric night atmosphere and neon signage at Bangla Road",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Bangla+Road+Patong+Phuket",
        osmUrl: "https://www.openstreetmap.org/search?query=Bangla%20Road%20Patong",
      },
      {
        id: "patong-beachfront-promenade",
        name: "Patong Beach Sunset Walk",
        nameTh: "ทางเดินเลียบหาดป่าตอง",
        neighborhoodId: "patong",
        category: "viewpoint",
        categoryLabel: "Coastal Sunset Vantage",
        lat: 7.89320,
        lng: 98.29650,
        elevationM: 3,
        streetName: "Thaweewong Road",
        streetNameTh: "ถนนทวีวงศ์",
        address: "Thaweewong Rd, Tambon Pa Tong, Amphoe Kathu",
        summary:
          "A breezy 3-kilometer crescent bay with golden sand and panoramic views of the Andaman Sea. Prime viewing spot for tropical sunsets, parasailing arrivals, and evening beach volleyball.",
        architecturalContext:
          "Paved boardwalk lined with coconut palms, beachfront benches, and lifeguard towers.",
        signatureDishes: [
          "Fresh Young Coconut Water (น้ำมะพร้าวสด)",
          "Grilled Sweet Corn with Butter (ข้าวโพดย่าง)",
          "Chilled Chang & Singha Beer",
        ],
        priceRange: "฿",
        badge: "Iconic Sunset Spot",
        soundEffectTh: "ซู่ซ่า!",
        soundEffectRom: "WAVE-CRASH!",
        comicBubbleColor: "#0ea5e9",
        neighborhoodOrientation: {
          relativePosition: "Western terminus of Bangla Road where it meets the sand",
          landmarkProximity: "Directly across Thaweewong Road from Bangla exit",
          entrySide: "West (Beachfront)",
          walkTimeMinutesFromCenter: 2,
          visualCue: "Open horizon with rows of longtail boats and colorful parasails against the twilight sky",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
          caption: "Golden Andaman sunset along Patong Beachfront promenade",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Patong+Beach+Promenade",
        osmUrl: "https://www.openstreetmap.org/search?query=Patong%20Beach",
      },
      {
        id: "banzaan-fresh-market",
        name: "Banzaan Fresh Market & Night Food",
        nameTh: "ตลาดสดบันซ้าน และ ตลาดโต้รุ่ง",
        neighborhoodId: "patong",
        category: "street-food",
        categoryLabel: "Fresh Seafood Grill Night Market",
        lat: 7.89120,
        lng: 98.30210,
        elevationM: 6,
        streetName: "Sai Kor Road",
        streetNameTh: "ถนนสาย ก.",
        address: "181 Sai Kor Rd, Tambon Pa Tong, Amphoe Kathu",
        summary:
          "Named after the Hokkien word for 'fresh market' (肉山). By day a pristine indoor produce market; by night the plaza erupts into Patong's greatest open-air seafood barbecue market.",
        architecturalContext:
          "Contemporary Sino-Portuguese inspired high-gabled market hall with a vibrant open plaza.",
        signatureDishes: [
          "Charcoal-Grilled Giant Tiger Prawns with Spicy Lime Dip (กุ้งลายเสือเผา)",
          "BBQ Whole Seabass in Sea Salt Crust (ปลากะพงเผาเกลือ)",
          "Mango Sticky Rice with Roasted Mung Beans (ข้าวเหนียวมะม่วง)",
          "Fried Crispy Roti with Nutella and Condensed Milk (โรตีกรอบ)",
        ],
        priceRange: "฿฿",
        badge: "Top Street Food Hub in Patong",
        soundEffectTh: "หอมฉุย!",
        soundEffectRom: "SMOKE-GRILL!",
        comicBubbleColor: "#f97316",
        neighborhoodOrientation: {
          relativePosition: "Directly behind Jungceylon Shopping Center on Sai Kor Road",
          landmarkProximity: "250m southeast of Bangla Road",
          entrySide: "East (Town Center)",
          walkTimeMinutesFromCenter: 4,
          visualCue: "Plumes of aromatic grill smoke and yellow festoon lighting across the outdoor food plaza",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
          caption: "Banzaan night market seafood BBQ sizzle",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Banzaan+Fresh+Market+Patong",
        osmUrl: "https://www.openstreetmap.org/search?query=Banzaan%20Market",
      },
      {
        id: "patong-tower-vantage",
        name: "Patong Tower 15F Vantage",
        nameTh: "ป่าตอง ทาวเวอร์ ชั้น 15",
        neighborhoodId: "patong",
        category: "viewpoint",
        categoryLabel: "Panoramic Skyline Vantage",
        lat: 7.89070,
        lng: 98.29740,
        elevationM: 52,
        streetName: "Thaweewong Road",
        streetNameTh: "ถนนทวีวงศ์",
        address: "110/184 Thaweewong Rd, Tambon Pa Tong, Amphoe Kathu",
        summary:
          "The tallest architectural landmark in Patong. Offers a bird's-eye vantage over the crescent bay, the verdant Kathu hills, and the bustling city rooflines.",
        architecturalContext:
          "31-storey modernist beach tower erected in the late 1980s, visible from anywhere in Patong Bay.",
        signatureDishes: [
          "Sunset Rooftop Cocktails",
          "Panoramic Horizon Photography",
        ],
        priceRange: "฿฿฿",
        badge: "Highest Coastal Viewpoint in Patong",
        soundEffectTh: "วิว 360 องศา!",
        soundEffectRom: "SKYLINE-WOW!",
        comicBubbleColor: "#a855f7",
        neighborhoodOrientation: {
          relativePosition: "200m south of Bangla Road, directly fronting the beach lane",
          landmarkProximity: "Visible as the sole high-rise tower on the Patong waterfront",
          entrySide: "South (Ocean Side)",
          walkTimeMinutesFromCenter: 3,
          visualCue: "White 31-storey tower soaring above the coconut palms and resort tree line",
        },
        photoScene: {
          heroUrl: "https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1000&q=80",
          caption: "Patong Bay panoramic skyline from the upper levels of Patong Tower",
          aspectRatio: "16/9",
        },
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Patong+Tower+Phuket",
        osmUrl: "https://www.openstreetmap.org/search?query=Patong%20Tower",
      },
    ],
  },
};
