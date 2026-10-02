# LINE OA → BOOMBOX TH Backoffice API

## ข้อเท็จจริงของระบบปัจจุบัน

`index.html` เป็น static app ที่เก็บข้อมูลใน browser `localStorage` key `boombox_data` จึงยังไม่มี database หรือ server endpoint สำหรับรับออเดอร์จาก LINE แบบถาวร

การเชื่อม LINE แบบ production ต้องเพิ่ม server-side storage ก่อน เช่น Vercel Postgres, Supabase, Neon หรือ API หลังบ้านที่มีฐานข้อมูล จากนั้นจึงติดตั้ง endpoint ตามสัญญาด้านล่าง

## Endpoint contract

```http
POST /api/integrations/line/orders
Authorization: Bearer <server-to-server-token>
Idempotency-Key: line:<webhook-event-id>
Content-Type: application/json
```

### Request

```json
{
  "source": "line",
  "lineUserId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "lineMessageId": "message-id-from-webhook",
  "customer": {
    "displayName": "คุณสมชาย",
    "phone": "0812345678",
    "shippingAddress": "ที่อยู่จัดส่ง"
  },
  "package": { "code": "B", "price": 389 },
  "deviceColor": "สีดำ",
  "scents": ["องุ่น", "มิ้นท์เย็น"],
  "paymentMethod": "cod",
  "shippingFee": 0,
  "customerNote": ""
}
```

### Response

```json
{
  "success": true,
  "order": {
    "id": "ORD-20261003-0001",
    "status": "pending_confirmation",
    "total": 389,
    "shippingFee": 0
  }
}
```

## Validation rules

- `package.code` ต้องเป็น A, B, C หรือ D และต้องอ่านราคา/จำนวนเม็ดจาก catalog server-side
- ราคามาตรฐาน: A ฿299, B ฿389, C ฿499, D ฿649
- A ไม่รับรายการกลิ่นที่ลูกค้าเลือกเอง
- B ต้องมี 2 กลิ่น, C ต้องมี 4 กลิ่น, D ต้องมี 6 กลิ่น และอนุญาตกลิ่นซ้ำ
- กลิ่นต้องอยู่ใน catalog 19 รายการ
- ก่อนยืนยันต้องตรวจ stock เครื่องและเม็ด
- ใช้ `Idempotency-Key` ป้องกัน webhook ซ้ำ
- ยังไม่ตัด stock จนกว่าลูกค้าจะยืนยันออเดอร์

## Order status

```text
pending_confirmation → confirmed → packing → shipped → completed
                         ↓
                      cancelled
```

## ขั้นตอนเชื่อมจริง

1. เพิ่มฐานข้อมูล server-side สำหรับ catalog, inventory, orders และ line conversations
2. เพิ่ม LINE webhook receiver เพื่อ verify signature และอ่าน message event
3. ให้ AI สรุปข้อมูลลูกค้าและเรียก `POST /api/integrations/line/orders`
4. ส่งสรุปออเดอร์ให้ลูกค้ายืนยันก่อนสร้างสถานะ `confirmed`
5. บันทึก order ลงฐานข้อมูลและแสดงใน Dashboard
6. ตัด/จอง stock แบบ transaction

ห้ามเก็บ Channel Secret หรือ Channel Access Token ในไฟล์ HTML, GitHub หรือ localStorage
