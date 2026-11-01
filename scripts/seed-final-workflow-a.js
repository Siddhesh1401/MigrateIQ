/**
 * MigrateIQ - Industrial Testbed Seeder for Workflow A (MongoDB → PostgreSQL)
 * 
 * Source Database (MongoDB):    final_mongo_workflow_a
 * Target Database (PostgreSQL): final_postgres_workflow_a
 * 
 * Generates an enterprise-grade NoSQL E-Commerce & Logistics dataset with:
 * - Nested arrays of objects (`orders.items`, `shipments.tracking_events`)
 * - High-precision financial fields (`Decimal128` on invoices)
 * - Static subdocuments for 1NF flattening (`customers.address`)
 * - Over 2,700 primary documents and thousands of nested sub-items
 * - Drops and prepares an empty PostgreSQL target database ready for live migration!
 */

const { MongoClient, ObjectId, Decimal128 } = require('mongodb');
const { Client: PgClient } = require('pg');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = 'final_mongo_workflow_a';

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASSWORD || 'admin';
const PG_DB_NAME = 'final_postgres_workflow_a';

async function main() {
  console.log('\n===============================================================');
  console.log('  🚀 MIGRATEIQ - WORKFLOW A (MongoDB → PostgreSQL) SEEDER');
  console.log('===============================================================\n');

  // ── 1. Prepare Target PostgreSQL Database (Clean Empty DB) ──────────────────
  console.log(`🐘 [1/3] Preparing pristine PostgreSQL target: ${PG_DB_NAME}...`);
  const rootPg = new PgClient({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASS,
    database: 'postgres'
  });

  try {
    await rootPg.connect();
    // Terminate existing connections to allow drop
    await rootPg.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [PG_DB_NAME]);

    await rootPg.query(`DROP DATABASE IF EXISTS "${PG_DB_NAME}";`);
    await rootPg.query(`CREATE DATABASE "${PG_DB_NAME}";`);
    console.log(`   ✅ Target PostgreSQL database "${PG_DB_NAME}" created (0 tables, pristine).`);
  } catch (err) {
    console.error(`   ❌ Failed to prepare PostgreSQL target:`, err.message);
    throw err;
  } finally {
    await rootPg.end();
  }

  // ── 2. Connect to MongoDB & Reset Source Database ───────────────────────────
  console.log(`\n🍃 [2/3] Connecting to MongoDB: ${MONGO_URI}...`);
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db(MONGO_DB_NAME);

  // Drop existing DB to ensure clean state
  await db.dropDatabase();
  console.log(`   ✅ Dropped existing MongoDB database "${MONGO_DB_NAME}".`);

  // ── 3. Populate Industrial Dataset ──────────────────────────────────────────
  console.log(`\n📦 [3/3] Generating enterprise dataset in MongoDB "${MONGO_DB_NAME}"...`);

  // (A) Categories (25 records)
  const categoryNames = [
    'Electronics', 'Laptops & Computers', 'Smartphones', 'Audio & Headphones', 'Wearables',
    'Home Appliances', 'Kitchenware', 'Furniture', 'Home Decor', 'Lighting',
    'Men Clothing', 'Women Clothing', 'Footwear', 'Watches & Jewelry', 'Luggage & Bags',
    'Sports & Fitness', 'Outdoor Gear', 'Automotive', 'Tools & Hardware', 'Garden & Patio',
    'Books & Stationery', 'Toys & Games', 'Health & Wellness', 'Beauty & Cosmetics', 'Office Supplies'
  ];

  const categoryDocs = categoryNames.map((name, i) => ({
    _id: new ObjectId(),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    code: `CAT-${100 + i}`,
    is_active: true,
    display_order: i + 1,
    created_at: new Date(Date.now() - (30 - i) * 86400000)
  }));
  await db.collection('categories').insertMany(categoryDocs);
  console.log(`   ✅ Inserted ${categoryDocs.length} categories.`);

  // (B) Customers (500 records with nested address subdocuments)
  const cities = [
    { city: 'New York', state: 'NY', zip: '10001' },
    { city: 'San Francisco', state: 'CA', zip: '94105' },
    { city: 'Austin', state: 'TX', zip: '78701' },
    { city: 'Seattle', state: 'WA', zip: '98101' },
    { city: 'Chicago', state: 'IL', zip: '60601' },
    { city: 'Boston', state: 'MA', zip: '02108' },
    { city: 'Denver', state: 'CO', zip: '80202' },
    { city: 'Miami', state: 'FL', zip: '33101' }
  ];

  const customerDocs = [];
  for (let i = 1; i <= 500; i++) {
    const loc = cities[i % cities.length];
    customerDocs.push({
      _id: new ObjectId(),
      customer_code: `CUST-${String(i).padStart(5, '0')}`,
      first_name: `Customer_${i}`,
      last_name: `User_${(i * 7) % 100}`,
      email: `customer${i}@enterprise-scale.io`,
      phone: `+1-555-${String(100 + (i % 900)).padStart(3, '0')}-${String(1000 + i).slice(-4)}`,
      loyalty_tier: i % 10 === 0 ? 'Platinum' : i % 4 === 0 ? 'Gold' : i % 2 === 0 ? 'Silver' : 'Bronze',
      loyalty_points: (i * 37) % 5000,
      is_active: i % 25 !== 0,
      address: {
        street: `${100 + (i * 3)} Market Boulevard, Suite ${i % 20 + 1}`,
        city: loc.city,
        state: loc.state,
        postal_code: loc.zip,
        country: 'USA'
      },
      created_at: new Date(Date.now() - (600 - i) * 86400000)
    });
  }
  await db.collection('customers').insertMany(customerDocs);
  console.log(`   ✅ Inserted ${customerDocs.length} customers (with nested 1NF address subdocuments).`);

  // (C) Products (250 records)
  const productDocs = [];
  for (let i = 1; i <= 250; i++) {
    const cat = categoryDocs[i % categoryDocs.length];
    const price = Math.round((15 + (i * 4.75) % 1200) * 100) / 100;
    productDocs.push({
      _id: new ObjectId(),
      sku: `SKU-${cat.code}-${String(i).padStart(4, '0')}`,
      name: `Pro ${cat.name.slice(0, 8)} Item ${i}`,
      category_id: cat._id.toString(),
      category_name: cat.name,
      price: price,
      cost_price: Math.round(price * 0.65 * 100) / 100,
      stock_quantity: 10 + (i * 13) % 450,
      is_available: true,
      tags: ['featured', 'enterprise', cat.name.toLowerCase()],
      created_at: new Date(Date.now() - (200 - i) * 86400000)
    });
  }
  await db.collection('products').insertMany(productDocs);
  console.log(`   ✅ Inserted ${productDocs.length} products.`);

  // (D) Orders (600 records with nested arrays of order items)
  const orderDocs = [];
  const shipmentDocs = [];
  const invoiceDocs = [];
  let totalOrderItemsCount = 0;
  let totalTrackingEventsCount = 0;

  for (let i = 1; i <= 600; i++) {
    const cust = customerDocs[i % customerDocs.length];
    const itemsCount = (i % 5) + 1; // 1 to 5 items per order
    const items = [];
    let orderTotal = 0;

    for (let j = 0; j < itemsCount; j++) {
      const prod = productDocs[(i * 3 + j) % productDocs.length];
      const qty = (j % 3) + 1;
      const unitPrice = prod.price;
      const subtotal = Math.round(unitPrice * qty * 100) / 100;
      orderTotal += subtotal;

      items.push({
        item_id: j + 1,
        product_id: prod._id.toString(),
        sku: prod.sku,
        product_name: prod.name,
        unit_price: unitPrice,
        quantity: qty,
        subtotal: subtotal
      });
      totalOrderItemsCount++;
    }

    orderTotal = Math.round(orderTotal * 100) / 100;
    const orderId = new ObjectId();
    const orderDate = new Date(Date.now() - (600 - i) * 3600000 * 4);
    const status = i % 15 === 0 ? 'cancelled' : i % 5 === 0 ? 'processing' : 'completed';

    // 1. Order document with nested items array
    orderDocs.push({
      _id: orderId,
      order_number: `ORD-2026-${String(10000 + i)}`,
      customer_id: cust._id.toString(),
      customer_email: cust.email,
      order_date: orderDate,
      order_status: status,
      total_amount: orderTotal,
      currency: 'USD',
      payment_method: i % 3 === 0 ? 'credit_card' : i % 3 === 1 ? 'paypal' : 'bank_transfer',
      items: items // 👈 NESTED ARRAY OF OBJECTS (Testing Array-to-Child Table Rule)
    });

    // 2. Shipment document with nested tracking_events array
    if (status !== 'cancelled') {
      const shipId = new ObjectId();
      const eventsCount = status === 'completed' ? 3 : 1;
      const trackingEvents = [];

      for (let k = 0; k < eventsCount; k++) {
        trackingEvents.push({
          step_number: k + 1,
          event_status: k === 0 ? 'Shipment Picked Up' : k === 1 ? 'In Transit Hub' : 'Delivered to Customer',
          location: k === 0 ? 'Dallas Fulfillment Center' : k === 1 ? 'Chicago Sorting Center' : cust.address.city,
          event_time: new Date(orderDate.getTime() + (k + 1) * 86400000),
          notes: k === 2 ? 'Signed by resident' : 'Scanned at dock'
        });
        totalTrackingEventsCount++;
      }

      shipmentDocs.push({
        _id: shipId,
        order_id: orderId.toString(),
        order_number: `ORD-2026-${String(10000 + i)}`,
        carrier: i % 2 === 0 ? 'FedEx' : 'UPS',
        tracking_number: `TRK-9900-${String(20000 + i)}`,
        shipped_date: new Date(orderDate.getTime() + 86400000),
        delivery_status: status === 'completed' ? 'DELIVERED' : 'IN_TRANSIT',
        tracking_events: trackingEvents // 👈 SECOND NESTED ARRAY OF OBJECTS
      });
    }

    // 3. Invoice document with high-precision Decimal128
    const taxAmount = Math.round(orderTotal * 0.0825 * 100) / 100;
    const finalAmount = Math.round((orderTotal + taxAmount) * 100) / 100;
    invoiceDocs.push({
      _id: new ObjectId(),
      invoice_number: `INV-2026-${String(30000 + i)}`,
      order_id: orderId.toString(),
      customer_id: cust._id.toString(),
      subtotal_amount: Decimal128.fromString(orderTotal.toFixed(2)), // 👈 Decimal128 testing
      tax_amount: Decimal128.fromString(taxAmount.toFixed(2)),
      total_due: Decimal128.fromString(finalAmount.toFixed(2)),
      is_paid: status === 'completed',
      due_date: new Date(orderDate.getTime() + 30 * 86400000),
      created_at: orderDate
    });
  }

  await db.collection('orders').insertMany(orderDocs);
  console.log(`   ✅ Inserted ${orderDocs.length} orders (containing ${totalOrderItemsCount} nested items).`);

  await db.collection('shipments').insertMany(shipmentDocs);
  console.log(`   ✅ Inserted ${shipmentDocs.length} shipments (containing ${totalTrackingEventsCount} tracking events).`);

  await db.collection('invoices').insertMany(invoiceDocs);
  console.log(`   ✅ Inserted ${invoiceDocs.length} invoices (with Decimal128 high-precision numbers).`);

  // (E) Customer Reviews (450 records)
  const reviewDocs = [];
  for (let i = 1; i <= 450; i++) {
    const cust = customerDocs[i % customerDocs.length];
    const prod = productDocs[(i * 2) % productDocs.length];
    reviewDocs.push({
      _id: new ObjectId(),
      product_id: prod._id.toString(),
      customer_id: cust._id.toString(),
      customer_name: `${cust.first_name} ${cust.last_name}`,
      rating: (i % 5) + 1,
      title: i % 2 === 0 ? 'Outstanding build quality' : 'Works as advertised',
      body: `Review comment for ${prod.name}: Extremely pleased with this purchase. High reliability and performance.`,
      is_verified_buyer: true,
      created_at: new Date(Date.now() - (450 - i) * 86400000)
    });
  }
  await db.collection('reviews').insertMany(reviewDocs);
  console.log(`   ✅ Inserted ${reviewDocs.length} reviews.`);

  await mongoClient.close();

  console.log('\n===============================================================');
  console.log('  🎉 WORKFLOW A TESTBED READY!');
  console.log('===============================================================');
  console.log(`  Source MongoDB:     "${MONGO_DB_NAME}" (~2,725 primary documents)`);
  console.log(`  Target PostgreSQL:  "${PG_DB_NAME}" (Pristine, 0 tables)`);
  console.log('  Child tables tested: orders.items → order_items (with sort_order)');
  console.log('                       shipments.tracking_events → shipment_tracking_events');
  console.log('  Types tested:        ObjectId, Decimal128, Date, 1NF subdocuments');
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error seeding Workflow A:', err);
  process.exit(1);
});

