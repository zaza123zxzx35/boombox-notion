function defaultSeedPreview() {
  const products = [];

  products.push({
    canonical_name: "กล่องสีฟ้า",
    product_type: "device",
    color: "ฟ้า",
    machine_type: "regular",
    pack_size: null,
    unit_name: "เครื่อง",
    counted_quantity: 6,
    flag: "ok",
    aliases: ["กล่องฟ้า", "regular ฟ้า", "ฟ้า"],
  });

  products.push({
    canonical_name: "กล่องสีดำ",
    product_type: "device",
    color: "ดำ",
    machine_type: "regular",
    pack_size: null,
    unit_name: "เครื่อง",
    counted_quantity: 5,
    flag: "discrepancy",
    discrepancy_reason: "รับจริง 41 เครื่องรวม, ขายไป 2 เครื่อง, นับจริง 35 เครื่อง; ส่วนต่าง 4 เครื่อง (กล่องดำขาด 1 เครื่อง จากสั่ง 6 ได้ 5 และ เม็ดแถม 200 เม็ด ขาด)",
    aliases: ["กล่องดำ", "regular ดำ", "ดำ"],
  });

  products.push({
    canonical_name: "กล่องสีเงิน",
    product_type: "device",
    color: "เงิน",
    machine_type: "regular",
    pack_size: null,
    unit_name: "เครื่อง",
    counted_quantity: 6,
    flag: "ok",
    aliases: ["กล่องเงิน", "regular เงิน", "เงิน"],
  });

  products.push({
    canonical_name: "Mini สีดำ",
    product_type: "device",
    color: "ดำ",
    machine_type: "mini",
    pack_size: null,
    unit_name: "เครื่อง",
    counted_quantity: 9,
    flag: "discrepancy",
    discrepancy_reason: "รับจริง 41 เครื่องรวม, ขายไป 2 เครื่อง, นับจริง 35 เครื่อง → ส่วนต่าง 4 เครื่อง; กล่องดำขาด 1 เครื่อง และ เม็ดแถม 200 เม็ด ขาด",
    aliases: ["มินิดำ", "mini ดำ", "mini black"],
  });

  products.push({
    canonical_name: "Mini สีขาว",
    product_type: "device",
    color: "ขาว",
    machine_type: "mini",
    pack_size: null,
    unit_name: "เครื่อง",
    counted_quantity: 9,
    flag: "discrepancy",
    discrepancy_reason: "รับจริง 41 เครื่องรวม, ขายไป 2 เครื่อง, นับจริง 35 เครื่อง → ส่วนต่าง 4 เครื่อง; กล่องดำขาด 1 เครื่อง และ เม็ดแถม 200 เม็ด ขาด",
    aliases: ["มินิขาว", "mini ขาว", "mini white"],
  });

  const scentPacks = [
    {
      name_th: "มิ้นต์เย็น",
      name_zh: "黑冰薄荷+零度薄荷",
      aliases: ["แบล็คไอซ์มิ้นท์", "บล็อกไอซ์มิ้น", "Black Ice Mint", "ซีโร่ดีกรีมิ้นท์", "Zero Degree Mint", "zero mint", "มิ้นดำ", "มิ้นเย็นสุด", "มิ้นศูนย์องศา", "สเปียร์มิ้นท์", "เปปเปอร์มิ้นท์", "เมนทอล"],
      packs: 24,
      flag: "ok",
      discrepancy_reason: "Physical Count ยืนยัน 24 ถุง (ปรับจาก 25 ↓ 24 ตามยอดนับจริง 2026-10-05; รวม Black Ice Mint + Zero Degree Mint = มิ้นต์เย็นเดียวกันตามกฎ)",
    },
    {
      name_th: "องุ่นหวาน",
      name_zh: "清甜葡萄",
      aliases: ["องุ่น", "grape", "green grape", "องุ่นเขียว", "องุ่นม่วงหวาน"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "แบล็คเบอร์รี่",
      name_zh: "黑莓味",
      aliases: ["แบล็คเบอร์รี", "blackberry", "เบอร์รีดำ"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "กล้วยนม",
      name_zh: "牛奶香蕉",
      aliases: ["กล้วย", "banana milk", "banana", "นมกล้วย"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "ลิ้นจี่",
      name_zh: "冰镇荔枝",
      aliases: ["ลิ้นจี่เย็น", "lychee ice", "lychee"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "ไอศกรีม",
      name_zh: "冰淇淋味",
      aliases: ["ice cream", "ไอศครีม", "vanilla ice cream", "ไอศกรีมวานิลลา"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "แอปเปิ้ลเขียว",
      name_zh: "冰青苹果",
      aliases: ["แอปเปิล", "apple ice", "green apple", "แอปเปิลเขียวเย็น"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "บลูเบอร์รี่",
      name_zh: "冰镇蓝莓",
      aliases: ["บลูเบอร์รี", "บลูเบอร์รีเย็น", "blueberry ice", "blueberry"],
      packs: 12,
      flag: "ok",
      discrepancy_reason: "Physical Count ยืนยัน 12 ถุง (ปรับจาก 10 ↑ 12 ตามยอดนับจริง 2026-10-05)",
    },
    {
      name_th: "แตงโม",
      name_zh: "冰沙西瓜",
      aliases: ["แตงโมปั่น", "แตงโมเย็น", "watermelon smoothie", "watermelon"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "ส้มซิตรัส",
      name_zh: "冰柑橘",
      aliases: ["ส้ม", "ส้มเย็น", "orange ice", "mandarin orange", "citrus", "ส้มสายชู", "ส้มจู๊ซ"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "สมุนไพรจีน",
      name_zh: "冰镇健力宝",
      aliases: ["เจี่ยนหลี่เปา", "jianlibao", "เจียนลี่เป่า", "สมุนไพรจีนเย็น", "健力宝", "เจียนลี่เป่าเย็น"],
      packs: 3,
      flag: "ok",
      discrepancy_reason: "Physical Count ยืนยัน 3 ถุง (ปรับจาก 5 ↓ 3 ตามยอดนับจริง 2026-10-05)",
    },
    {
      name_th: "โคล่า",
      name_zh: "冰可乐味",
      aliases: ["โคล่าเย็น", "cola ice", "coke", "cola", "โคล่าอัดลม"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "หอมหมื่นลี้",
      name_zh: "冰桂花味",
      aliases: ["หอมหมื่นลี้เย็น", "osmanthus ice", "osmanthus", "กวีฮวา", "ออสแมนทัส", "ออสแมนทัสเย็น"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "แคนตาลูป",
      name_zh: "冰镇哈密瓜",
      aliases: ["แคนตาลูปเย็น", "cantaloupe ice", "เมล่อน", "hami melon", "เมล่อนจีน"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "รวมกลิ่น",
      name_zh: "无冰混合",
      aliases: ["มิกซ์", "mixed", "mix flavor", "รวมรส", "ผสม", "มิกซ์ไร้น้ำแข็ง", "มิกซ์ไร้น้ำแข็ง/สมุนไพรไม่เย็น"],
      packs: 94,
      flag: "ok",
      discrepancy_reason: "Physical Count ยืนยัน 94 ถุง (20 ถุงจาก 19 บรรทัดสั่งจีน 无冰混合 + 74 ถุงนับจริงอีกชุด = 94 ถุง Available ปกติ; User ยืนยัน 74 หน่วย = 74 ถุง 100 เม็ด/ถุง 2026-10-05)",
    },
    {
      name_th: "เลมอน",
      name_zh: "冰香水柠檬",
      aliases: ["มะนาว", "มะนาวหอม", "lemon perfume ice", "เลมอนหอม", "lemon", "เลมอนหอมเย็น"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "องุ่นเย็น",
      name_zh: "冰葡萄",
      aliases: ["องุ่นแดงเย็น", "grape ice red", "red grape", "องุ่น ice", "องุ่นซ่าเย็น"],
      packs: 10,
      flag: "ok",
    },
    {
      name_th: "สตรอเบอร์รี่",
      name_zh: "冰草莓",
      aliases: ["สตรอว์เบอร์รี", "สตรอเบอร์รีเย็น", "strawberry ice", "สตอเบอร์รี", "strawberry"],
      packs: 10,
      flag: "ok",
    },
  ];

  scentPacks.forEach((scent) => {
    products.push({
      canonical_name: scent.name_th,
      product_type: "scent_pack",
      pack_size: 100,
      unit_name: "เม็ด",
      counted_quantity: scent.packs * 100,
      flag: scent.flag,
      aliases: scent.aliases || [],
      ...(scent.discrepancy_reason ? { discrepancy_reason: scent.discrepancy_reason } : {}),
    });
  });

  return { products };
}

export { defaultSeedPreview };
export default defaultSeedPreview;
