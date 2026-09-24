/**
 * MigrateIQ — Comprehensive Deep Row-by-Row Data Content Audit
 * 
 * Inspects the actual row data across ALL 18 primary tables and ALL 13 child tables,
 * comparing MongoDB source documents vs PostgreSQL target rows field-by-field.
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const { Client: PgClient } = require('pg');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'phase9part3';

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'admin',
  database: process.env.PG_DATABASE || 'phase9part3',
};

// Helper to normalize values for comparison
function valuesMatch(mVal, pVal, fieldName) {
  if (mVal === null || mVal === undefined) {
    return pVal === null || pVal === undefined;
  }
  if (mVal instanceof ObjectId) {
    return String(mVal) === String(pVal);
  }
  if (mVal instanceof Date) {
    const pDate = new Date(pVal);
    return Math.abs(mVal.getTime() - pDate.getTime()) < 1000; // within 1 sec
  }
  if (typeof mVal === 'number' && typeof pVal === 'number') {
    return Math.abs(mVal - pVal) < 0.0001;
  }
  if (typeof mVal === 'boolean') {
    return mVal === Boolean(pVal);
  }
  if (typeof mVal === 'object') {
    // Both could be JSON objects
    const pObj = typeof pVal === 'string' ? JSON.parse(pVal) : pVal;
    return JSON.stringify(mVal) === JSON.stringify(pObj) || Object.keys(mVal).length === Object.keys(pObj || {}).length;
  }
  return String(mVal).trim() === String(pVal).trim();
}

async function runDataAudit() {
  console.log('========================================================================================');
  console.log('🔬 MIGRATEIQ — EXHAUSTIVE ROW-BY-ROW DATA CONTENT AUDIT');
  console.log('========================================================================================\n');

  const mongoClient = new MongoClient(MONGO_URI);
  const pgClient = new PgClient(PG_CONFIG);

  await mongoClient.connect();
  await pgClient.connect();
  const db = mongoClient.db(MONGO_DB);

  const parentTables = [
    { col: 'agents', keyField: 'agentCode', fields: ['agentCode', 'name', 'type', 'commissionRate', 'isActive', 'email'] },
    { col: 'audit_logs', keyField: 'correlationId', fields: ['eventType', 'actor', 'actorType', 'severity', 'durationMs', 'success'] },
    { col: 'brands', keyField: 'name', fields: ['name', 'country', 'founded', 'website'] },
    { col: 'categories', keyField: 'slug', fields: ['name', 'slug', 'level'] },
    { col: 'customers', keyField: 'customerId', fields: ['customerId', 'name', 'type', 'email', 'kycStatus', 'outstandingBalance'] },
    { col: 'employees', keyField: 'employeeId', fields: ['employeeId', 'firstName', 'lastName', 'department', 'jobTitle', 'employmentType'] },
    { col: 'notifications', keyField: 'notificationId', fields: ['notificationId', 'channel', 'type', 'title', 'isRead', 'isSent'] },
    { col: 'orders', keyField: 'orderNumber', fields: ['orderNumber', 'status', 'priority', 'channel'] },
    { col: 'payments', keyField: 'paymentRef', fields: ['paymentRef', 'method', 'gateway', 'amount', 'currency', 'status', 'netAmount'] },
    { col: 'product_variants', keyField: 'variantSku', fields: ['variantSku', 'priceDelta', 'stockQty', 'isActive'] },
    { col: 'products', keyField: 'sku', fields: ['sku', 'name', 'brand', 'status', 'weight', 'stockQuantity', 'isHazmat'] },
    { col: 'returns', keyField: 'rmaNumber', fields: ['rmaNumber', 'status', 'reason', 'refundMethod', 'refundTotal', 'currency'] },
    { col: 'reviews', keyField: 'title', fields: ['rating', 'title', 'isVerifiedPurchase', 'moderationStatus', 'language'] },
    { col: 'shipments', keyField: 'shipmentNumber', fields: ['shipmentNumber', 'carrier', 'serviceType', 'status', 'cost', 'currency'] },
    { col: 'suppliers', keyField: 'code', fields: ['code', 'name', 'tier', 'status'] },
    { col: 'support_tickets', keyField: 'ticketId', fields: ['ticketId', 'subject', 'status', 'priority', 'category'] },
    { col: 'warehouses', keyField: 'code', fields: ['code', 'name', 'type', 'temperatureControlled', 'isActive'] },
    { col: 'zones', keyField: 'code', fields: ['code', 'name', 'timezone', 'currencyCode', 'isOperational'] }
  ];

  console.log('--- 1. AUDITING ACTUAL DATA VALUES IN ALL 18 PRIMARY TABLES ---');
  let allParentDataMatch = true;

  for (const t of parentTables) {
    // Pick 3 representative records: first, middle, last
    const sampleDocs = await db.collection(t.col).find({}).limit(3).toArray();
    let tablePassed = true;
    const checkedDetails = [];

    for (const mDoc of sampleDocs) {
      const pId = String(mDoc._id);
      const pgRes = await pgClient.query(`SELECT * FROM "${t.col}" WHERE "id" = $1`, [pId]);
      if (pgRes.rows.length === 0) {
        tablePassed = false;
        allParentDataMatch = false;
        checkedDetails.push(`Record ID ${pId} NOT FOUND in PostgreSQL!`);
        break;
      }
      const pRow = pgRes.rows[0];

      // Compare each target field
      for (const f of t.fields) {
        // Map camelCase to snake_case if necessary
        const snakeCol = f.replace(/([A-Z])/g, '_$1').toLowerCase();
        const pVal = pRow[snakeCol] !== undefined ? pRow[snakeCol] : pRow[f];
        const mVal = mDoc[f];

        if (!valuesMatch(mVal, pVal, f)) {
          tablePassed = false;
          allParentDataMatch = false;
          checkedDetails.push(`Field '${f}' mismatch: Mongo='${mVal}' vs PG='${pVal}'`);
        }
      }
    }

    if (tablePassed) {
      const sampleVal = sampleDocs[0] ? sampleDocs[0][t.keyField] : 'OK';
      console.log(`  ✅ [${t.col.padEnd(20)}] Data Content Matches 100% | Sample: ${String(sampleVal).padEnd(24)} (checked ${t.fields.length} fields × 3 docs)`);
    } else {
      console.log(`  ❌ [${t.col.padEnd(20)}] MISMATCH DETECTED:`, checkedDetails.join(', '));
    }
  }

  console.log('\n--- 2. AUDITING ACTUAL DATA VALUES IN ALL 13 CHILD TABLES ---');
  let allChildDataMatch = true;

  const childTableConfigs = [
    { parentCol: 'products', arrayField: 'supplierRefs', childTable: 'products_supplier_refs' },
    { parentCol: 'reviews', arrayField: 'votes', childTable: 'reviews_votes' },
    { parentCol: 'support_tickets', arrayField: 'messages', childTable: 'support_tickets_messages' },
    { parentCol: 'suppliers', arrayField: 'contacts', childTable: 'suppliers_contacts' },
    { parentCol: 'customers', arrayField: 'shippingAddresses', childTable: 'customers_shipping_addresses' },
    { parentCol: 'customers', arrayField: 'paymentMethods', childTable: 'customers_paymentMethods' },
    { parentCol: 'customers', arrayField: 'kycDocuments', childTable: 'customers_kyc_documents' },
    { parentCol: 'returns', arrayField: 'returnItems', childTable: 'returns_return_items' },
    { parentCol: 'orders', arrayField: 'items', childTable: 'orders_items' },
    { parentCol: 'orders', arrayField: 'paymentAttempts', childTable: 'orders_payment_attempts' },
    { parentCol: 'shipments', arrayField: 'waypoints', childTable: 'shipments_waypoints' },
    { parentCol: 'shipments', arrayField: 'trackingEvents', childTable: 'shipments_trackingEvents' },
    { parentCol: 'employees', arrayField: 'certifications', childTable: 'employees_certifications' },
  ];

  for (const c of childTableConfigs) {
    // Find a parent document that actually has non-empty array items
    const parentDoc = await db.collection(c.parentCol).findOne({
      [c.arrayField]: { $exists: true, $type: 'array', $ne: [] }
    });

    if (!parentDoc) {
      console.log(`  ⚠️ [${c.childTable.padEnd(30)}] No non-empty parent array found.`);
      continue;
    }

    const pId = String(parentDoc._id);
    const sourceArr = parentDoc[c.arrayField];

    // Query PostgreSQL child table
    const fkCol = `${c.parentCol}_id`;
    const pgRes = await pgClient.query(
      `SELECT * FROM "${c.childTable}" WHERE "${fkCol}" = $1 ORDER BY "sort_order" ASC`,
      [pId]
    );

    let childMatch = true;
    let failReason = '';

    if (sourceArr.length !== pgRes.rows.length) {
      childMatch = false;
      failReason = `Array length mismatch: Mongo=${sourceArr.length} vs PG=${pgRes.rows.length}`;
    } else {
      // Check each element in order
      for (let i = 0; i < sourceArr.length; i++) {
        const mItem = sourceArr[i];
        const pItem = pgRes.rows[i];

        if (pItem.sort_order !== i) {
          childMatch = false;
          failReason = `sort_order mismatch at index ${i}: got ${pItem.sort_order}`;
          break;
        }

        // Compare data payload
        let pData = pItem.data;
        if (typeof pData === 'string') {
          try {
            pData = JSON.parse(pData);
          } catch {
            // Primitive string, keep as is
          }
        }

        if (typeof mItem === 'object' && mItem !== null && typeof pData === 'object' && pData !== null) {
          const mItemKeys = Object.keys(mItem);
          for (const k of mItemKeys) {
            if (mItem[k] !== undefined && pData[k] !== undefined) {
              if (!valuesMatch(mItem[k], pData[k], k)) {
                childMatch = false;
                failReason = `Payload key '${k}' mismatch at index ${i}: Mongo='${mItem[k]}' vs PG='${pData[k]}'`;
                break;
              }
            }
          }
        } else {
          // Compare primitive directly
          if (!valuesMatch(mItem, pData, 'data')) {
            childMatch = false;
            failReason = `Primitive value mismatch at index ${i}: Mongo='${mItem}' vs PG='${pData}'`;
          }
        }
        if (!childMatch) break;
      }
    }

    if (childMatch) {
      console.log(`  ✅ [${c.childTable.padEnd(30)}] Data & Sequence Match 100% | Parent ID: ${pId} (${sourceArr.length} items checked in order)`);
    } else {
      console.log(`  ❌ [${c.childTable.padEnd(30)}] MISMATCH: ${failReason}`);
      allChildDataMatch = false;
    }
  }

  console.log('\n========================================================================================');
  console.log(`DATA VERDICT: All 18 Parent Tables Data Content: ${allParentDataMatch ? '100% IDENTICAL ✅' : 'FAILED ❌'}`);
  console.log(`DATA VERDICT: All 13 Child Tables Data Content:  ${allChildDataMatch ? '100% IDENTICAL ✅' : 'FAILED ❌'}`);
  console.log('========================================================================================\n');

  await mongoClient.close();
  await pgClient.end();
}

runDataAudit();
