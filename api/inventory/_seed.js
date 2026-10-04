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
    discrepancy_reason: "กล่องดำขาด 1 เครื่องจากที่สั่ง 6 ได้ 5 (รวม 200 เม็ดแถมที่ขาดด้วย)",
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
    discrepancy_reason: "ส่วนต่างเครื่อง 4 เครื่องระหว่างคำนวณ 39 กับนับ 35",
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
    discrepancy_reason: "ส่วนต่างเครื่อง 4 เครื่องระหว่างคำนวณ 39 กับนับ 35",
    aliases: ["มินิขาว", "mini ขาว", "mini white"],
  });

  const scentPacks = [
    {
      name_th: "Black Ice Mint",
      name_zh: "黑冰薄荷",
      aliases: ["ไอศกรีมมิ้นดำ", "black ice", "บล็อกไอซ์มิ้น", "มิ้นดำ"],
      packs: 12,
      flag: "discrepancy",
      discrepancy_reason: "มิ้น 24 pack alias แยกไม่ชัด รวมกับ Zero Mint",
    },
    {
      name_th: "องุ่น",
      name_zh: "清甜葡萄",
      aliases: ["องุ่นหวาน", "grape", "green grape"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "แบล็คเบอร์รี",
      name_zh: "黑莓味",
      aliases: ["บล็คเบอร์รี", "blackberry", "เบอร์รีดำ"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "กล้วย",
      name_zh: "牛奶香蕉",
      aliases: ["กล้วยนม", "banana milk", "banana"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "ลิ้นจี่",
      name_zh: "冰镇荔枝",
      aliases: ["ลิ้นจี่เย็น", "lychee ice", "lychee"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "ไอศกรีม",
      name_zh: "冰淇淋味",
      aliases: ["ice cream", "ไอศครีม", "vanilla ice cream"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "แอปเปิล",
      name_zh: "冰青苹果",
      aliases: ["แอปเปิลเขียว", "apple ice", "green apple"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "บลูเบอร์รี",
      name_zh: "冰镇蓝莓",
      aliases: ["บลูเบอร์รีเย็น", "blueberry ice", "blueberry"],
      packs: 10,
      flag: "discrepancy",
      discrepancy_reason: "ส่วนต่าง 12 vs 10 pack จากการนับ",
    },
    {
      name_th: "แตงโม",
      name_zh: "冰沙西瓜",
      aliases: ["แตงโมปั่น", "watermelon smoothie", "watermelon"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "ส้ม",
      name_zh: "冰柑橘",
      aliases: ["ส้มเย็น", "orange ice", "mandarin orange", "citrus"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "Zero Degree Mint",
      name_zh: "零度薄荷",
      aliases: ["ซีโร่ดีกรีมิ้น", "zero mint", "มิ้นศูนย์องศา", "มิ้นเย็นสุด"],
      packs: 12,
      flag: "discrepancy",
      discrepancy_reason: "มิ้น 24 pack alias แยกไม่ชัด รวมกับ Black Ice Mint",
    },
    {
      name_th: "สมุนไพรจีน Jianlibao",
      name_zh: "冰镇健力宝",
      aliases: ["เจี่ยนหลี่เปา", "jianlibao", "สมุนไพรจีนเย็น", "健力宝"],
      packs: 3,
      flag: "discrepancy",
      discrepancy_reason: "ส่วนต่าง 3 vs 5 pack จากการนับ",
    },
    {
      name_th: "โคล่า",
      name_zh: "冰可乐味",
      aliases: ["โคล่าเย็น", "cola ice", "coke", "cola"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "หอมหมื่นลี้",
      name_zh: "冰桂花味",
      aliases: ["หอมหมื่นลี้เย็น", "osmanthus ice", "osmanthus", "กวีฮวา"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "แคนตาลูป",
      name_zh: "冰镇哈密瓜",
      aliases: ["แคนตาลูปเย็น", "cantaloupe ice", "เมล่อน", "hami melon"],
      packs: 4,
      flag: "ok",
    },
    {
      name_th: "รวมกลิ่น",
      name_zh: "无冰混合",
      aliases: ["มิกซ์", "mixed", "mix flavor", "รวมรส", "ผสม"],
      packs: 74,
      flag: "blocked",
      discrepancy_reason: "74 หน่วยไม่ชัดแยกกลิ่นได้ ต้องแยกย่อยก่อนใช้งาน",
    },
    {
      name_th: "มะนาว",
      name_zh: "冰香水柠檬",
      aliases: ["มะนาวหอม", "lemon perfume ice", "เลมอนหอม", "lemon"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "องุ่นเย็น",
      name_zh: "冰葡萄",
      aliases: ["องุ่นแดงเย็น", "grape ice red", "red grape", "องุ่น ice"],
      packs: 5,
      flag: "ok",
    },
    {
      name_th: "สตรอว์เบอร์รี",
      name_zh: "冰草莓",
      aliases: ["สตรอเบอร์รีเย็น", "strawberry ice", "สตอเบอร์รี", "strawberry"],
      packs: 6,
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
