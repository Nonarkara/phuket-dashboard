import type { Coordinates } from "../types/dashboard";

export interface ThaiProvince {
  name: string;
  nameTh: string;
  center: Coordinates;
  region: "north" | "northeast" | "central" | "east" | "west" | "south";
  borderArea?: "western" | "deep-south" | "northern" | "eastern";
}

/**
 * All 77 Thai provinces with center-point coordinates for label placement.
 * Border-relevant provinces are tagged with their border area.
 */
export const THAI_PROVINCES: ThaiProvince[] = [
  // ── Northern ──────────────────────────────────────────────
  { name: "Chiang Mai", nameTh: "เชียงใหม่", center: [98.98, 18.79], region: "north", borderArea: "northern" },
  { name: "Chiang Rai", nameTh: "เชียงราย", center: [99.83, 19.91], region: "north", borderArea: "northern" },
  { name: "Lampang", nameTh: "ลำปาง", center: [99.50, 18.29], region: "north" },
  { name: "Lamphun", nameTh: "ลำพูน", center: [99.01, 18.58], region: "north" },
  { name: "Mae Hong Son", nameTh: "แม่ฮ่องสอน", center: [97.97, 19.30], region: "north", borderArea: "western" },
  { name: "Nan", nameTh: "น่าน", center: [100.77, 18.77], region: "north", borderArea: "northern" },
  { name: "Phayao", nameTh: "พะเยา", center: [99.68, 19.17], region: "north" },
  { name: "Phrae", nameTh: "แพร่", center: [100.14, 18.14], region: "north" },
  { name: "Uttaradit", nameTh: "อุตรดิตถ์", center: [100.10, 17.63], region: "north" },

  // ── Northeast (Isan) ─────────────────────────────────────
  { name: "Nong Khai", nameTh: "หนองคาย", center: [102.74, 17.88], region: "northeast", borderArea: "eastern" },
  { name: "Loei", nameTh: "เลย", center: [101.72, 17.49], region: "northeast" },
  { name: "Udon Thani", nameTh: "อุดรธานี", center: [102.81, 17.42], region: "northeast" },
  { name: "Sakon Nakhon", nameTh: "สกลนคร", center: [104.15, 17.16], region: "northeast" },
  { name: "Nakhon Phanom", nameTh: "นครพนม", center: [104.78, 17.39], region: "northeast", borderArea: "eastern" },
  { name: "Mukdahan", nameTh: "มุกดาหาร", center: [104.72, 16.54], region: "northeast", borderArea: "eastern" },
  { name: "Khon Kaen", nameTh: "ขอนแก่น", center: [102.84, 16.43], region: "northeast" },
  { name: "Kalasin", nameTh: "กาฬสินธุ์", center: [103.51, 16.43], region: "northeast" },
  { name: "Maha Sarakham", nameTh: "มหาสารคาม", center: [103.30, 16.18], region: "northeast" },
  { name: "Roi Et", nameTh: "ร้อยเอ็ด", center: [103.65, 16.05], region: "northeast" },
  { name: "Yasothon", nameTh: "ยโสธร", center: [104.15, 15.79], region: "northeast" },
  { name: "Amnat Charoen", nameTh: "อำนาจเจริญ", center: [104.63, 15.87], region: "northeast" },
  { name: "Ubon Ratchathani", nameTh: "อุบลราชธานี", center: [104.87, 15.24], region: "northeast", borderArea: "eastern" },
  { name: "Si Sa Ket", nameTh: "ศรีสะเกษ", center: [104.33, 15.12], region: "northeast" },
  { name: "Surin", nameTh: "สุรินทร์", center: [103.49, 14.88], region: "northeast" },
  { name: "Buriram", nameTh: "บุรีรัมย์", center: [103.10, 14.99], region: "northeast" },
  { name: "Nakhon Ratchasima", nameTh: "นครราชสีมา", center: [102.10, 14.97], region: "northeast" },
  { name: "Chaiyaphum", nameTh: "ชัยภูมิ", center: [102.03, 15.81], region: "northeast" },
  { name: "Bueng Kan", nameTh: "บึงกาฬ", center: [103.65, 18.36], region: "northeast", borderArea: "eastern" },
  { name: "Nong Bua Lam Phu", nameTh: "หนองบัวลำภู", center: [102.43, 17.20], region: "northeast" },

  // ── Central ───────────────────────────────────────────────
  { name: "Bangkok", nameTh: "กรุงเทพฯ", center: [100.50, 13.76], region: "central" },
  { name: "Nonthaburi", nameTh: "นนทบุรี", center: [100.51, 13.86], region: "central" },
  { name: "Pathum Thani", nameTh: "ปทุมธานี", center: [100.53, 14.02], region: "central" },
  { name: "Samut Prakan", nameTh: "สมุทรปราการ", center: [100.60, 13.60], region: "central" },
  { name: "Samut Sakhon", nameTh: "สมุทรสาคร", center: [100.28, 13.55], region: "central" },
  { name: "Samut Songkhram", nameTh: "สมุทรสงคราม", center: [100.00, 13.41], region: "central" },
  { name: "Nakhon Pathom", nameTh: "นครปฐม", center: [100.06, 13.82], region: "central" },
  { name: "Ayutthaya", nameTh: "อยุธยา", center: [100.59, 14.35], region: "central" },
  { name: "Ang Thong", nameTh: "อ่างทอง", center: [100.45, 14.59], region: "central" },
  { name: "Sing Buri", nameTh: "สิงห์บุรี", center: [100.40, 14.89], region: "central" },
  { name: "Lop Buri", nameTh: "ลพบุรี", center: [100.65, 14.80], region: "central" },
  { name: "Saraburi", nameTh: "สระบุรี", center: [100.91, 14.53], region: "central" },
  { name: "Nakhon Nayok", nameTh: "นครนายก", center: [101.21, 14.21], region: "central" },
  { name: "Chainat", nameTh: "ชัยนาท", center: [100.13, 15.19], region: "central" },
  { name: "Uthai Thani", nameTh: "อุทัยธานี", center: [99.72, 15.38], region: "central" },
  { name: "Nakhon Sawan", nameTh: "นครสวรรค์", center: [100.12, 15.70], region: "central" },
  { name: "Kamphaeng Phet", nameTh: "กำแพงเพชร", center: [99.52, 16.48], region: "central" },
  { name: "Phichit", nameTh: "พิจิตร", center: [100.35, 16.44], region: "central" },
  { name: "Phitsanulok", nameTh: "พิษณุโลก", center: [100.26, 16.82], region: "central" },
  { name: "Phetchabun", nameTh: "เพชรบูรณ์", center: [101.16, 16.42], region: "central" },
  { name: "Sukhothai", nameTh: "สุโขทัย", center: [99.83, 17.01], region: "central" },

  // ── West ──────────────────────────────────────────────────
  { name: "Tak", nameTh: "ตาก", center: [99.13, 16.88], region: "west", borderArea: "western" },
  { name: "Kanchanaburi", nameTh: "กาญจนบุรี", center: [99.54, 14.02], region: "west", borderArea: "western" },
  { name: "Ratchaburi", nameTh: "ราชบุรี", center: [99.83, 13.54], region: "west" },
  { name: "Phetchaburi", nameTh: "เพชรบุรี", center: [99.95, 13.11], region: "west" },
  { name: "Prachuap Khiri Khan", nameTh: "ประจวบคีรีขันธ์", center: [99.80, 11.81], region: "west", borderArea: "western" },
  { name: "Suphan Buri", nameTh: "สุพรรณบุรี", center: [100.12, 14.47], region: "west" },

  // ── East ──────────────────────────────────────────────────
  { name: "Chachoengsao", nameTh: "ฉะเชิงเทรา", center: [101.08, 13.69], region: "east" },
  { name: "Prachin Buri", nameTh: "ปราจีนบุรี", center: [101.37, 14.05], region: "east" },
  { name: "Sa Kaeo", nameTh: "สระแก้ว", center: [102.07, 13.82], region: "east", borderArea: "eastern" },
  { name: "Chon Buri", nameTh: "ชลบุรี", center: [100.98, 13.36], region: "east" },
  { name: "Rayong", nameTh: "ระยอง", center: [101.24, 12.68], region: "east" },
  { name: "Chanthaburi", nameTh: "จันทบุรี", center: [102.10, 12.61], region: "east" },
  { name: "Trat", nameTh: "ตราด", center: [102.52, 12.24], region: "east", borderArea: "eastern" },

  // ── South ─────────────────────────────────────────────────
  { name: "Chumphon", nameTh: "ชุมพร", center: [99.18, 10.49], region: "south" },
  { name: "Ranong", nameTh: "ระนอง", center: [98.64, 9.97], region: "south", borderArea: "western" },
  { name: "Surat Thani", nameTh: "สุราษฎร์ธานี", center: [99.32, 9.13], region: "south" },
  { name: "Phang Nga", nameTh: "พังงา", center: [98.53, 8.45], region: "south" },
  { name: "Phuket", nameTh: "ภูเก็ต", center: [98.39, 7.88], region: "south" },
  { name: "Krabi", nameTh: "กระบี่", center: [98.91, 8.09], region: "south" },
  { name: "Nakhon Si Thammarat", nameTh: "นครศรีธรรมราช", center: [99.93, 8.43], region: "south" },
  { name: "Trang", nameTh: "ตรัง", center: [99.62, 7.56], region: "south" },
  { name: "Phatthalung", nameTh: "พัทลุง", center: [100.07, 7.62], region: "south" },
  { name: "Songkhla", nameTh: "สงขลา", center: [100.47, 7.19], region: "south" },
  { name: "Satun", nameTh: "สตูล", center: [100.07, 6.62], region: "south" },
  { name: "Pattani", nameTh: "ปัตตานี", center: [101.25, 6.87], region: "south", borderArea: "deep-south" },
  { name: "Yala", nameTh: "ยะลา", center: [101.28, 6.54], region: "south", borderArea: "deep-south" },
  { name: "Narathiwat", nameTh: "นราธิวาส", center: [101.82, 6.43], region: "south", borderArea: "deep-south" },
];

/**
 * Province center-point data formatted for deck.gl TextLayer.
 */
export function getProvinceLabels() {
  return THAI_PROVINCES.map((province) => ({
    name: province.name,
    coordinates: province.center,
    region: province.region,
    borderArea: province.borderArea,
  }));
}

/**
 * Get only border-relevant provinces for highlighting.
 */
export function getBorderProvinces() {
  return THAI_PROVINCES.filter((province) => province.borderArea);
}
