# เชื่อมฐานข้อมูลกับ Vercel

## ตัวเลือกที่ใช้ในโค้ดนี้

โปรเจกต์นี้ใช้ **Supabase** ผ่าน REST API จาก Vercel Serverless Function จึงไม่ต้องเพิ่ม dependency ใน `index.html`

## 1. สร้าง Supabase Project

1. เข้า https://supabase.com/dashboard
2. สร้าง Project ใหม่
3. เปิด **SQL Editor**
4. วางไฟล์ `supabase/migrations/001_line_orders.sql`
5. กด Run

## 2. เพิ่ม Environment Variables ใน Vercel

ไปที่ Vercel Project → Settings → Environment Variables แล้วเพิ่ม:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
LINE_ORDER_API_TOKEN=<random-long-server-token>
BACKOFFICE_ADMIN_TOKEN=<random-long-admin-token>
```

ใช้ค่า service-role เฉพาะใน Vercel Serverless Function เท่านั้น ห้ามใส่ `NEXT_PUBLIC_`, HTML, localStorage หรือ GitHub

สร้าง token แบบสุ่มได้ด้วย:

```bash
openssl rand -hex 32
```

เลือก Environment เป็น `Production` และ `Preview` ตามที่ต้องการ แล้ว Redeploy

## 3. API Endpoint

### รับออเดอร์จาก LINE/AI

```http
POST /api/integrations/line/orders
Authorization: Bearer <LINE_ORDER_API_TOKEN>
Idempotency-Key: line:<line-event-id>
```

### อ่านออเดอร์สำหรับ Dashboard

```http
GET /api/integrations/line/orders
X-Admin-Token: <BACKOFFICE_ADMIN_TOKEN>
```

### เปลี่ยนสถานะ

```http
PATCH /api/integrations/line/orders?id=<uuid>
X-Admin-Token: <BACKOFFICE_ADMIN_TOKEN>
Content-Type: application/json
```

```json
{ "status": "confirmed" }
```

## 4. เชื่อม LINE Developers

LINE Developers → Messaging API → Webhook settings:

```text
https://<your-vercel-domain>/api/integrations/line/webhook
```

หมายเหตุ: ไฟล์ใน commit นี้ทำ endpoint สำหรับรับออเดอร์ที่ถูกสรุปแล้ว ส่วน webhook ที่ verify `x-line-signature`, อ่านข้อความ และคุยตอบลูกค้า ควรเป็น endpoint แยกอีกตัวเพื่อความปลอดภัยและดูแลง่าย

## 5. ทดสอบ API

```bash
curl -X POST https://<your-vercel-domain>/api/integrations/line/orders \
  -H "Authorization: Bearer $LINE_ORDER_API_TOKEN" \
  -H "Idempotency-Key: line:test-001" \
  -H "Content-Type: application/json" \
  -d '{
    "source":"line",
    "lineMessageId":"test-001",
    "customer":{"displayName":"ทดสอบ"},
    "package":{"code":"B","price":389},
    "deviceColor":"สีดำ",
    "scents":["องุ่น","มิ้นท์เย็น"],
    "paymentMethod":"cod",
    "shippingFee":0
  }'
```

## ข้อควรทำก่อนใช้งานจริง

- เพิ่ม LINE webhook receiver และตรวจ signature ด้วย Channel Secret
- ทำ Supabase RLS policy หากเปิด client-side access ในอนาคต
- ย้ายการตัด stock ไป transaction/function ในฐานข้อมูล
- เพิ่ม login ของเจ้าของร้านสำหรับ Dashboard แทนการใช้ admin token ใน browser
- ไม่ให้ service-role key อยู่ใน frontend
