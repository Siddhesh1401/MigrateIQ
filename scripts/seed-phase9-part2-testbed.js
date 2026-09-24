/**
 * MigrateIQ — Phase 9 Part 2 Enterprise Benchmark Database Generator
 * Database: MongoDB 'phase9_part2'
 * 
 * Generates an industry-level enterprise E-Commerce & Supply Chain dataset
 * with ~30,735 top-level documents and ~21,000 embedded child line items
 * (~51,735 total records in target PostgreSQL).
 * 
 * Features Tested:
 * - High-throughput batch streaming (500 docs/batch)
 * - Animated table-by-table progress bars & live ETA calculations in MigrateIQ UI
 * - Cross-collection foreign key resolution (orders -> customers, products -> categories, etc.)
 * - Embedded array child table extraction (orders.items -> orders_items with sort_order)
 * - Deep nested JSONB objects (shippingAddress, specs, routeDetails)
 * - Polymorphic audit log payloads
 * - Nullable fields, timestamps, floats, and integer fields
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'phase9_part2';

// Seed constants
const NUM_DEPARTMENTS = 25;
const NUM_CATEGORIES = 60;
const NUM_SUPPLIERS = 150;
const NUM_CUSTOMERS = 2500;
const NUM_PRODUCTS = 4000;
const NUM_ORDERS = 6000;
const NUM_SHIPMENTS = 3000;
const NUM_REVIEWS = 5000;
const NUM_AUDIT_EVENTS = 10000;

// Helper random functions
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, decimals = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randDate = (startYear = 2024, endYear = 2026) => {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 8, 24).getTime();
  return new Date(start + Math.random() * (end - start));
};

async function seedPhase9Part2() {
  const startTime = Date.now();
  console.log(`🚀 Connecting to MongoDB: ${MONGO_URI}/${DB_NAME}...`);
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`🧹 Dropping existing collections in '${DB_NAME}' for clean testbed...`);
    const existingCollections = await db.listCollections().toArray();
    for (const col of existingCollections) {
      await db.collection(col.name).drop();
    }
    console.log(`✅ Database '${DB_NAME}' cleaned.`);

    // 1. Departments (25)
    console.log(`📦 Generating ${NUM_DEPARTMENTS} departments...`);
    const deptNames = [
      'Consumer Electronics', 'Industrial Automation', 'Enterprise Cloud Hardware',
      'Renewable Energy Systems', 'Precision Robotics', 'Aerospace Avionics',
      'Automotive Components', 'Medical Technology', 'Telecommunications',
      'Smart Home Systems', 'Commercial HVAC', 'Semiconductor Machinery',
      'Optoelectronics', 'Power Distribution', 'Logistics Fleet Hardware',
      'Heavy Machinery Parts', 'Security & Surveillance', 'Audio Engineering',
      'Displays & MicroLED', 'Quantum Compute Modules', 'Bioinformatics Equipment',
      'Nanotech Fabrication', 'Marine Navigation', 'Railway Signaling', 'Satellite Comm'
    ];
    const departments = [];
    for (let i = 0; i < NUM_DEPARTMENTS; i++) {
      departments.push({
        _id: new ObjectId(),
        code: `DEP-${String(i + 1).padStart(3, '0')}`,
        name: deptNames[i] || `Department Unit ${i + 1}`,
        budget: randFloat(250000, 5000000),
        headOfDepartment: `Director ${['Smith', 'Patel', 'Chen', 'Vogel', 'Dubois', 'Kowalski', 'Tanaka', 'Muller'][i % 8]}`,
        establishedYear: randInt(1995, 2024),
        isActive: Math.random() > 0.05,
        createdDate: randDate(2020, 2024)
      });
    }
    await db.collection('departments').insertMany(departments);
    console.log(`  ✓ Inserted ${departments.length} departments.`);

    // 2. Categories (60)
    console.log(`📦 Generating ${NUM_CATEGORIES} categories...`);
    const categories = [];
    const catPrefixes = ['Enterprise', 'Industrial', 'Pro', 'High-Efficiency', 'Compact', 'Precision', 'Heavy-Duty', 'Modular'];
    const catTypes = ['Sensors', 'Controllers', 'Processors', 'Transceivers', 'Actuators', 'Inverters', 'Modules', 'Converters'];
    for (let i = 0; i < NUM_CATEGORIES; i++) {
      const parentCat = i > 10 && Math.random() > 0.4 ? randChoice(categories)._id : null;
      const dept = randChoice(departments);
      const name = `${randChoice(catPrefixes)} ${randChoice(catTypes)} Gen-${(i % 5) + 1}`;
      categories.push({
        _id: new ObjectId(),
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        departmentId: dept._id,
        parentId: parentCat,
        displayPriority: randInt(1, 100),
        attributes: {
          isoCompliant: Math.random() > 0.1,
          leadTimeWeeks: randInt(1, 8),
          requiresCertification: Math.random() > 0.3
        },
        createdAt: randDate(2021, 2024)
      });
    }
    await db.collection('categories').insertMany(categories);
    console.log(`  ✓ Inserted ${categories.length} categories.`);

    // 3. Suppliers (150)
    console.log(`📦 Generating ${NUM_SUPPLIERS} suppliers...`);
    const suppliers = [];
    const cities = ['San Jose', 'Munich', 'Shenzhen', 'Tokyo', 'Zurich', 'Seoul', 'Austin', 'Singapore', 'Stockholm', 'Toronto'];
    for (let i = 0; i < NUM_SUPPLIERS; i++) {
      const city = randChoice(cities);
      suppliers.push({
        _id: new ObjectId(),
        supplierCode: `SUP-${String(i + 1).padStart(4, '0')}`,
        companyName: `Global Technologies ${i + 1} Corp`,
        taxIdentifier: `US-EIN-${randInt(100000000, 999999999)}`,
        contactPerson: `Account Rep ${i + 1}`,
        email: `partner-desk-${i + 1}@globaltechcorp.com`,
        phone: `+1-555-${randInt(100, 999)}-${randInt(1000, 9999)}`,
        rating: randFloat(3.5, 5.0),
        address: {
          street: `${randInt(100, 9999)} Tech Park Blvd Ste ${randInt(10, 500)}`,
          city,
          state: 'State-' + (i % 20),
          zipCode: String(randInt(10000, 99999)),
          country: 'USA',
          isHeadquarters: Math.random() > 0.5
        },
        categoriesSupplied: [randChoice(categories).name, randChoice(categories).name],
        isActive: Math.random() > 0.03,
        onboardedAt: randDate(2021, 2024)
      });
    }
    await db.collection('suppliers').insertMany(suppliers);
    console.log(`  ✓ Inserted ${suppliers.length} suppliers.`);

    // 4. Customers (2,500)
    console.log(`📦 Generating ${NUM_CUSTOMERS} customers (bulk batches)...`);
    const firstNames = ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Sophia', 'Alexander', 'Mia', 'William', 'Isabella', 'Benjamin', 'Charlotte'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez'];
    const tiers = ['ENTERPRISE', 'PLATINUM', 'GOLD', 'STANDARD'];
    const tagOptions = ['b2b', 'vip', 'net30-approved', 'tax-exempt', 'eu-gdpr', 'credit-freeze-flag', 'bulk-buyer'];

    const customers = [];
    for (let i = 0; i < NUM_CUSTOMERS; i++) {
      const fn = randChoice(firstNames);
      const ln = randChoice(lastNames);
      const tier = randChoice(tiers);
      const creditLimit = tier === 'ENTERPRISE' ? randFloat(100000, 1000000) : tier === 'PLATINUM' ? randFloat(50000, 100000) : tier === 'GOLD' ? randFloat(15000, 50000) : randFloat(2000, 15000);
      customers.push({
        _id: new ObjectId(),
        customerCode: `CUST-${String(i + 1).padStart(6, '0')}`,
        firstName: fn,
        lastName: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${i + 1}@enterprise-client.io`,
        phone: `+1-800-${randInt(100, 999)}-${randInt(1000, 9999)}`,
        tier,
        creditLimit,
        primaryAddress: {
          street: `${randInt(10, 9999)} Industrial Way`,
          city: randChoice(cities),
          state: 'State-' + (i % 50),
          zipCode: String(randInt(10000, 99999)),
          country: 'USA',
          geo: { lat: randFloat(25.0, 48.0, 4), lng: randFloat(-122.0, -70.0, 4) }
        },
        tags: [randChoice(tagOptions), randChoice(tagOptions)],
        isActive: Math.random() > 0.02,
        createdAt: randDate(2022, 2025),
        lastLoginAt: Math.random() > 0.1 ? randDate(2025, 2026) : null
      });
    }

    // Insert in chunks of 1000
    for (let i = 0; i < customers.length; i += 1000) {
      await db.collection('customers').insertMany(customers.slice(i, i + 1000));
    }
    console.log(`  ✓ Inserted ${customers.length} customers.`);

    // 5. Products (4,000)
    console.log(`📦 Generating ${NUM_PRODUCTS} products (bulk batches)...`);
    const productNouns = ['Transceiver', 'Controller', 'Actuator', 'Switch Matrix', 'Inverter', 'Optical Fiber Cable', 'Power Supply Unit', 'Microcontroller Array'];
    const materials = ['Titanium Alloy', 'Silicon Carbide', 'Aerospace Aluminum', 'Industrial Polymer', 'Gallium Nitride'];

    const products = [];
    for (let i = 0; i < NUM_PRODUCTS; i++) {
      const wholesaleCost = randFloat(15, 2500);
      const markup = randFloat(1.2, 2.5);
      const price = parseFloat((wholesaleCost * markup).toFixed(2));
      const category = randChoice(categories);
      const supplier = randChoice(suppliers);

      products.push({
        _id: new ObjectId(),
        sku: `SKU-${category.name.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(6, '0')}`,
        title: `${category.name} ${randChoice(productNouns)} Rev.${randInt(1, 9)}`,
        categoryId: category._id,
        supplierId: supplier._id,
        price,
        wholesaleCost,
        stockQuantity: randInt(5, 5000),
        reorderThreshold: randInt(20, 200),
        specs: {
          weightKg: randFloat(0.1, 85.0),
          dimensionsCm: { l: randInt(5, 120), w: randInt(5, 90), h: randInt(2, 60) },
          material: randChoice(materials),
          warrantyYears: randChoice([1, 2, 3, 5, 10])
        },
        isDiscontinued: Math.random() > 0.95,
        publishedAt: randDate(2023, 2025)
      });
    }

    for (let i = 0; i < products.length; i += 1000) {
      await db.collection('products').insertMany(products.slice(i, i + 1000));
    }
    console.log(`  ✓ Inserted ${products.length} products.`);

    // 6. Orders (6,000) with EMBEDDED ARRAY 'items' (3-6 items each)
    console.log(`📦 Generating ${NUM_ORDERS} orders with embedded array items (~21,000 child records)...`);
    const orderStatuses = ['DELIVERED', 'SHIPPED', 'PROCESSING', 'PENDING', 'CANCELLED'];
    const paymentMethods = ['CREDIT_CARD', 'ACH_TRANSFER', 'PAYPAL', 'CORPORATE_TERMS'];

    const orders = [];
    let totalChildItems = 0;

    for (let i = 0; i < NUM_ORDERS; i++) {
      const customer = randChoice(customers);
      const itemCount = randInt(3, 6);
      const items = [];
      let subtotal = 0;

      for (let j = 0; j < itemCount; j++) {
        const prod = randChoice(products);
        const qty = randInt(1, 10);
        const lineTotal = parseFloat((prod.price * qty).toFixed(2));
        subtotal += lineTotal;
        items.push({
          productId: prod._id,
          sku: prod.sku,
          productName: prod.title,
          quantity: qty,
          unitPrice: prod.price,
          lineTotal
        });
      }
      totalChildItems += items.length;

      subtotal = parseFloat(subtotal.toFixed(2));
      const shippingCost = randFloat(15, 150);
      const taxAmount = parseFloat((subtotal * 0.0825).toFixed(2));
      const totalAmount = parseFloat((subtotal + shippingCost + taxAmount).toFixed(2));

      orders.push({
        _id: new ObjectId(),
        orderNumber: `ORD-2026-${String(i + 1).padStart(7, '0')}`,
        customerId: customer._id,
        status: randChoice(orderStatuses),
        paymentMethod: randChoice(paymentMethods),
        subtotal,
        shippingCost,
        taxAmount,
        totalAmount,
        shippingAddress: {
          recipientName: `${customer.firstName} ${customer.lastName}`,
          street: customer.primaryAddress.street,
          city: customer.primaryAddress.city,
          postalCode: customer.primaryAddress.zipCode,
          country: 'USA'
        },
        orderDate: randDate(2025, 2026),
        notes: Math.random() > 0.6 ? `Special delivery instructions: Dock bay ${randInt(1, 12)}` : null,
        items // Embedded array decomposed to orders_items with sort_order!
      });
    }

    for (let i = 0; i < orders.length; i += 1000) {
      await db.collection('orders').insertMany(orders.slice(i, i + 1000));
    }
    console.log(`  ✓ Inserted ${orders.length} orders containing ${totalChildItems} embedded line items.`);

    // 7. Shipments (3,000)
    console.log(`📦 Generating ${NUM_SHIPMENTS} logistics shipments...`);
    const carriers = ['FEDEX', 'DHL_EXPRESS', 'UPS_FREIGHT', 'MAERSK_LOGISTICS'];
    const shipmentStatuses = ['DELIVERED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'EXCEPTION'];

    const shipments = [];
    for (let i = 0; i < NUM_SHIPMENTS; i++) {
      const order = orders[i % orders.length];
      const carrier = randChoice(carriers);
      const dispatchDate = new Date(order.orderDate.getTime() + randInt(1, 3) * 86400000);
      const estArrival = new Date(dispatchDate.getTime() + randInt(2, 7) * 86400000);
      const isDelivered = Math.random() > 0.2;
      const actualArrival = isDelivered ? new Date(estArrival.getTime() + randInt(-1, 2) * 86400000) : null;

      shipments.push({
        _id: new ObjectId(),
        trackingNumber: `TRK-${carrier.substring(0, 3)}-${String(i + 1).padStart(8, '0')}`,
        orderId: order._id,
        carrier,
        weightKg: randFloat(1.5, 250.0),
        dispatchDate,
        estimatedArrival: estArrival,
        actualArrival,
        status: isDelivered ? 'DELIVERED' : randChoice(shipmentStatuses),
        routeDetails: {
          hubOrigin: `HUB-${randChoice(cities).toUpperCase()}`,
          hubDestination: `HUB-${order.shippingAddress.city.toUpperCase()}`,
          stopsCount: randInt(1, 4)
        }
      });
    }

    for (let i = 0; i < shipments.length; i += 1000) {
      await db.collection('shipments').insertMany(shipments.slice(i, i + 1000));
    }
    console.log(`  ✓ Inserted ${shipments.length} shipments.`);

    // 8. Reviews (5,000)
    console.log(`📦 Generating ${NUM_REVIEWS} product reviews...`);
    const headlines = [
      'Outstanding enterprise reliability',
      'Solid performance within specifications',
      'Easy integration into our automation stack',
      'Good build quality but documentation needs improvement',
      'Exceeded thermal expectations under continuous load',
      'Reliable vendor, fast procurement cycle'
    ];

    const reviews = [];
    for (let i = 0; i < NUM_REVIEWS; i++) {
      const prod = randChoice(products);
      const cust = randChoice(customers);
      reviews.push({
        _id: new ObjectId(),
        productId: prod._id,
        customerId: cust._id,
        rating: randChoice([3, 4, 4, 5, 5, 5]),
        headline: randChoice(headlines),
        comment: `Verified test run on revision batch. Unit performed reliably across 500 operating hours. Recommended for high-uptime deployments.`,
        verifiedBuyer: Math.random() > 0.05,
        helpfulVotes: randInt(0, 45),
        submittedAt: randDate(2025, 2026)
      });
    }

    for (let i = 0; i < reviews.length; i += 1000) {
      await db.collection('reviews').insertMany(reviews.slice(i, i + 1000));
    }
    console.log(`  ✓ Inserted ${reviews.length} reviews.`);

    // 9. Audit Events (10,000)
    console.log(`📦 Generating ${NUM_AUDIT_EVENTS} enterprise audit log events...`);
    const eventTypes = [
      'USER_AUTHENTICATION', 'ORDER_CHECKOUT', 'INVENTORY_RESERVATION',
      'DISCOUNT_APPLIED', 'CREDIT_LIMIT_INCREASE', 'SYSTEM_HEALTH_CHECK',
      'API_TOKEN_ROTATION', 'CONFIGURATION_CHANGE'
    ];
    const severities = ['DEBUG', 'INFO', 'INFO', 'WARN', 'CRITICAL'];

    const auditEvents = [];
    for (let i = 0; i < NUM_AUDIT_EVENTS; i++) {
      const eventType = randChoice(eventTypes);
      auditEvents.push({
        _id: new ObjectId(),
        eventType,
        actor: `service-worker-${randInt(1, 15)}@cluster.internal`,
        ipAddress: `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
        userAgent: 'MigrateIQ-Agent/2.4 (Enterprise Engine; Linux x86_64)',
        actionPayload: {
          requestId: `REQ-${String(i + 1).padStart(8, '0')}`,
          executionDurationMs: randInt(5, 450),
          nodeCluster: `zone-${['us-east', 'us-west', 'eu-central', 'ap-south'][i % 4]}`,
          success: Math.random() > 0.02
        },
        severity: randChoice(severities),
        recordedAt: randDate(2025, 2026)
      });
    }

    for (let i = 0; i < auditEvents.length; i += 2000) {
      await db.collection('audit_events').insertMany(auditEvents.slice(i, i + 2000));
    }
    console.log(`  ✓ Inserted ${auditEvents.length} audit events.`);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTopLevel = departments.length + categories.length + suppliers.length +
      customers.length + products.length + orders.length +
      shipments.length + reviews.length + auditEvents.length;

    console.log('\n======================================================');
    console.log('🎉 PHASE 9 PART 2 ENTERPRISE TESTBED SEEDING COMPLETE!');
    console.log('======================================================');
    console.log(`• MongoDB Database:       ${DB_NAME}`);
    console.log(`• Collections Created:    9 collections`);
    console.log(`• Top-level Documents:    ${totalTopLevel.toLocaleString()} documents`);
    console.log(`• Embedded Order Items:   ${totalChildItems.toLocaleString()} items (decomposes to 'orders_items' child table)`);
    console.log(`• Projected PG Total:     ~${(totalTopLevel + totalChildItems).toLocaleString()} rows`);
    console.log(`• Seeding Execution Time: ${durationSec}s`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Error seeding Phase 9 Part 2 database:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedPhase9Part2();
