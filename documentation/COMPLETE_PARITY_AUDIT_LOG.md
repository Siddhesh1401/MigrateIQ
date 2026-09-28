# 🔬 MigrateIQ Complete Forensic Record-by-Record Parity Audit Log
**Audit Run Date:** 2026-09-28T19:02:20.365Z
**Source DB:** `phase9b_source_mongo` (MongoDB port 27017)
**Target DB:** `phase9b_target_pg` (PostgreSQL port 5432)

---

## 1. Table: `users` (All 50 Records Audited Individually)
| # | MongoDB ID | Name | Email | Role | Age | Balance | Street | City | State | Match Status |
|:---:|:---|:---|:---|:---|:---:|:---:|:---|:---|:---:|:---:|
| 1 | `6aba7ff9d401bf99e1aef0a9` | Customer 1 Standard | customer1@migrateiq-test.org | vendor | 22 | $62.35 | 101 Enterprise Way, Suite 1 | San Francisco | CA | ✅ 100% Match |
| 2 | `6aba7ff9d401bf99e1aef0aa` | Customer 2 Standard | customer2@migrateiq-test.org | support | 23 | $74.70 | 102 Enterprise Way, Suite 2 | Austin | TX | ✅ 100% Match |
| 3 | `6aba7ff9d401bf99e1aef0ab` | Customer 3 Standard | customer3@migrateiq-test.org | manager | 24 | $87.05 | 103 Enterprise Way, Suite 3 | Chicago | IL | ✅ 100% Match |
| 4 | `6aba7ff9d401bf99e1aef0ac` | Customer 4 Standard | customer4@migrateiq-test.org | admin | 25 | $99.40 | 104 Enterprise Way, Suite 4 | Seattle | WA | ✅ 100% Match |
| 5 | `6aba7ff9d401bf99e1aef0ad` | Customer 5 Standard | customer5@migrateiq-test.org | customer | 26 | $111.75 | 105 Enterprise Way, Suite 5 | Boston | MA | ✅ 100% Match |
| 6 | `6aba7ff9d401bf99e1aef0ae` | Customer 6 Standard | customer6@migrateiq-test.org | vendor | 27 | $124.10 | 106 Enterprise Way, Suite 6 | New York | NY | ✅ 100% Match |
| 7 | `6aba7ff9d401bf99e1aef0af` | Customer 7 Standard | customer7@migrateiq-test.org | support | 28 | $136.45 | 107 Enterprise Way, Suite 7 | San Francisco | CA | ✅ 100% Match |
| 8 | `6aba7ff9d401bf99e1aef0b0` | Customer 8 Standard | customer8@migrateiq-test.org | manager | 29 | $148.80 | 108 Enterprise Way, Suite 8 | Austin | TX | ✅ 100% Match |
| 9 | `6aba7ff9d401bf99e1aef0b1` | Customer 9 Standard | customer9@migrateiq-test.org | admin | 30 | $161.15 | 109 Enterprise Way, Suite 9 | Chicago | IL | ✅ 100% Match |
| 10 | `6aba7ff9d401bf99e1aef0b2` | Customer 10 Standard | customer10@migrateiq-test.org | customer | 31 | $173.50 | 110 Enterprise Way, Suite 10 | Seattle | WA | ✅ 100% Match |
| 11 | `6aba7ff9d401bf99e1aef0b3` | Customer 11 Standard | customer11@migrateiq-test.org | vendor | 32 | $185.85 | 111 Enterprise Way, Suite 11 | Boston | MA | ✅ 100% Match |
| 12 | `6aba7ff9d401bf99e1aef0b4` | Customer 12 Standard | customer12@migrateiq-test.org | support | 33 | $198.20 | 112 Enterprise Way, Suite 12 | New York | NY | ✅ 100% Match |
| 13 | `6aba7ff9d401bf99e1aef0b5` | Customer 13 Standard | customer13@migrateiq-test.org | manager | 34 | $210.55 | 113 Enterprise Way, Suite 13 | San Francisco | CA | ✅ 100% Match |
| 14 | `6aba7ff9d401bf99e1aef0b6` | Customer 14 Standard | customer14@migrateiq-test.org | admin | 35 | $222.90 | 114 Enterprise Way, Suite 14 | Austin | TX | ✅ 100% Match |
| 15 | `6aba7ff9d401bf99e1aef0b7` | Customer 15 Standard | customer15@migrateiq-test.org | customer | 36 | $235.25 | 115 Enterprise Way, Suite 15 | Chicago | IL | ✅ 100% Match |
| 16 | `6aba7ff9d401bf99e1aef0b8` | Customer 16 Standard | customer16@migrateiq-test.org | vendor | 37 | $247.60 | 116 Enterprise Way, Suite 16 | Seattle | WA | ✅ 100% Match |
| 17 | `6aba7ff9d401bf99e1aef0b9` | Customer 17 Standard | customer17@migrateiq-test.org | support | 38 | $259.95 | 117 Enterprise Way, Suite 17 | Boston | MA | ✅ 100% Match |
| 18 | `6aba7ff9d401bf99e1aef0ba` | Customer 18 Standard | customer18@migrateiq-test.org | manager | 39 | $272.30 | 118 Enterprise Way, Suite 18 | New York | NY | ✅ 100% Match |
| 19 | `6aba7ff9d401bf99e1aef0bb` | Customer 19 Standard | customer19@migrateiq-test.org | admin | 40 | $284.65 | 119 Enterprise Way, Suite 19 | San Francisco | CA | ✅ 100% Match |
| 20 | `6aba7ff9d401bf99e1aef0bc` | Customer 20 Standard | customer20@migrateiq-test.org | customer | 41 | $297.00 | 120 Enterprise Way, Suite 20 | Austin | TX | ✅ 100% Match |
| 21 | `6aba7ff9d401bf99e1aef0bd` | Customer 21 Standard | customer21@migrateiq-test.org | vendor | 42 | $309.35 | 121 Enterprise Way, Suite 21 | Chicago | IL | ✅ 100% Match |
| 22 | `6aba7ff9d401bf99e1aef0be` | Customer 22 Standard | customer22@migrateiq-test.org | support | 43 | $321.70 | 122 Enterprise Way, Suite 22 | Seattle | WA | ✅ 100% Match |
| 23 | `6aba7ff9d401bf99e1aef0bf` | Customer 23 Standard | customer23@migrateiq-test.org | manager | 44 | $334.05 | 123 Enterprise Way, Suite 23 | Boston | MA | ✅ 100% Match |
| 24 | `6aba7ff9d401bf99e1aef0c0` | Customer 24 Standard | customer24@migrateiq-test.org | admin | 45 | $346.40 | 124 Enterprise Way, Suite 24 | New York | NY | ✅ 100% Match |
| 25 | `6aba7ff9d401bf99e1aef0c1` | Customer 25 Standard | customer25@migrateiq-test.org | customer | 46 | $358.75 | 125 Enterprise Way, Suite 25 | San Francisco | CA | ✅ 100% Match |
| 26 | `6aba7ff9d401bf99e1aef0c2` | Customer 26 Standard | customer26@migrateiq-test.org | vendor | 47 | $371.10 | 126 Enterprise Way, Suite 26 | Austin | TX | ✅ 100% Match |
| 27 | `6aba7ff9d401bf99e1aef0c3` | Customer 27 Standard | customer27@migrateiq-test.org | support | 48 | $383.45 | 127 Enterprise Way, Suite 27 | Chicago | IL | ✅ 100% Match |
| 28 | `6aba7ff9d401bf99e1aef0c4` | Customer 28 Standard | customer28@migrateiq-test.org | manager | 49 | $395.80 | 128 Enterprise Way, Suite 28 | Seattle | WA | ✅ 100% Match |
| 29 | `6aba7ff9d401bf99e1aef0c5` | Customer 29 Standard | customer29@migrateiq-test.org | admin | 50 | $408.15 | 129 Enterprise Way, Suite 29 | Boston | MA | ✅ 100% Match |
| 30 | `6aba7ff9d401bf99e1aef0c6` | Customer 30 Standard | customer30@migrateiq-test.org | customer | 51 | $420.50 | 130 Enterprise Way, Suite 30 | New York | NY | ✅ 100% Match |
| 31 | `6aba7ff9d401bf99e1aef0c7` | Customer 31 Standard | customer31@migrateiq-test.org | vendor | 52 | $432.85 | 131 Enterprise Way, Suite 31 | San Francisco | CA | ✅ 100% Match |
| 32 | `6aba7ff9d401bf99e1aef0c8` | Customer 32 Standard | customer32@migrateiq-test.org | support | 53 | $445.20 | 132 Enterprise Way, Suite 32 | Austin | TX | ✅ 100% Match |
| 33 | `6aba7ff9d401bf99e1aef0c9` | Customer 33 Standard | customer33@migrateiq-test.org | manager | 54 | $457.55 | 133 Enterprise Way, Suite 33 | Chicago | IL | ✅ 100% Match |
| 34 | `6aba7ff9d401bf99e1aef0ca` | Customer 34 Standard | customer34@migrateiq-test.org | admin | 55 | $469.90 | 134 Enterprise Way, Suite 34 | Seattle | WA | ✅ 100% Match |
| 35 | `6aba7ff9d401bf99e1aef0cb` | Customer 35 Standard | customer35@migrateiq-test.org | customer | 56 | $482.25 | 135 Enterprise Way, Suite 35 | Boston | MA | ✅ 100% Match |
| 36 | `6aba7ff9d401bf99e1aef0cc` | Customer 36 Standard | customer36@migrateiq-test.org | vendor | 57 | $494.60 | 136 Enterprise Way, Suite 36 | New York | NY | ✅ 100% Match |
| 37 | `6aba7ff9d401bf99e1aef0cd` | Customer 37 Standard | customer37@migrateiq-test.org | support | 58 | $506.95 | 137 Enterprise Way, Suite 37 | San Francisco | CA | ✅ 100% Match |
| 38 | `6aba7ff9d401bf99e1aef0ce` | Customer 38 Standard | customer38@migrateiq-test.org | manager | 59 | $519.30 | 138 Enterprise Way, Suite 38 | Austin | TX | ✅ 100% Match |
| 39 | `6aba7ff9d401bf99e1aef0cf` | Customer 39 Standard | customer39@migrateiq-test.org | admin | 60 | $531.65 | 139 Enterprise Way, Suite 39 | Chicago | IL | ✅ 100% Match |
| 40 | `6aba7ff9d401bf99e1aef0d0` | Customer 40 Standard | customer40@migrateiq-test.org | customer | 61 | $544.00 | 140 Enterprise Way, Suite 40 | Seattle | WA | ✅ 100% Match |
| 41 | `6aba7ff9d401bf99e1aef0d1` | Customer 41 Standard | customer41@migrateiq-test.org | vendor | 62 | $556.35 | 141 Enterprise Way, Suite 41 | Boston | MA | ✅ 100% Match |
| 42 | `6aba7ff9d401bf99e1aef0d2` | Customer 42 Standard | customer42@migrateiq-test.org | support | 63 | $568.70 | 142 Enterprise Way, Suite 42 | New York | NY | ✅ 100% Match |
| 43 | `6aba7ff9d401bf99e1aef0d3` | Customer 43 Standard | customer43@migrateiq-test.org | manager | 64 | $581.05 | 143 Enterprise Way, Suite 43 | San Francisco | CA | ✅ 100% Match |
| 44 | `6aba7ff9d401bf99e1aef0d4` | Customer 44 Standard | customer44@migrateiq-test.org | admin | 65 | $593.40 | 144 Enterprise Way, Suite 44 | Austin | TX | ✅ 100% Match |
| 45 | `6aba7ff9d401bf99e1aef0d5` | Customer 45 Standard | customer45@migrateiq-test.org | customer | 21 | $605.75 | 145 Enterprise Way, Suite 45 | Chicago | IL | ✅ 100% Match |
| 46 | `6aba7ff9d401bf99e1aef0d6` | Customer 46 Standard | customer46@migrateiq-test.org | vendor | 22 | $618.10 | 146 Enterprise Way, Suite 46 | Seattle | WA | ✅ 100% Match |
| 47 | `6aba7ff9d401bf99e1aef0d7` | Customer 47 Standard | customer47@migrateiq-test.org | support | 23 | $630.45 | 147 Enterprise Way, Suite 47 | Boston | MA | ✅ 100% Match |
| 48 | `6aba7ff9d401bf99e1aef0d8` | Customer 48 Standard | customer48@migrateiq-test.org | manager | 24 | $642.80 | 148 Enterprise Way, Suite 48 | New York | NY | ✅ 100% Match |
| 49 | `6aba7ff9d401bf99e1aef0d9` | Customer 49 Standard | customer49@migrateiq-test.org | admin | 25 | $655.15 | 149 Enterprise Way, Suite 49 | San Francisco | CA | ✅ 100% Match |
| 50 | `6aba7ff9d401bf99e1aef0da` | Customer 50 Standard | customer50@migrateiq-test.org | customer | 26 | $667.50 | 150 Enterprise Way, Suite 50 | Austin | TX | ✅ 100% Match |

## 2. Table: `categories` (All 10 Records Audited Individually)
| # | MongoDB ID | Name | Slug | Display Order | Active | Match Status |
|:---:|:---|:---|:---|:---:|:---:|:---:|
| 1 | `6aba7ff8d401bf99e1aef09f` | Electronics | `electronics` | 1 | true | ✅ 100% Match |
| 2 | `6aba7ff8d401bf99e1aef0a0` | Furniture | `furniture` | 2 | true | ✅ 100% Match |
| 3 | `6aba7ff8d401bf99e1aef0a1` | Clothing | `clothing` | 3 | true | ✅ 100% Match |
| 4 | `6aba7ff8d401bf99e1aef0a2` | Books | `books` | 4 | true | ✅ 100% Match |
| 5 | `6aba7ff8d401bf99e1aef0a3` | Home & Garden | `home---garden` | 5 | true | ✅ 100% Match |
| 6 | `6aba7ff8d401bf99e1aef0a4` | Sports | `sports` | 6 | true | ✅ 100% Match |
| 7 | `6aba7ff8d401bf99e1aef0a5` | Toys | `toys` | 7 | true | ✅ 100% Match |
| 8 | `6aba7ff8d401bf99e1aef0a6` | Groceries | `groceries` | 8 | true | ✅ 100% Match |
| 9 | `6aba7ff8d401bf99e1aef0a7` | Automotive | `automotive` | 9 | true | ✅ 100% Match |
| 10 | `6aba7ff8d401bf99e1aef0a8` | Beauty | `beauty` | 10 | true | ✅ 100% Match |

## 3. Table: `products` (All 50 Records Audited Individually)
| # | MongoDB ID | Name | SKU | Category | Price | Stock | Match Status |
|:---:|:---|:---|:---|:---|:---:|:---:|:---:|
| 1 | `6aba7ff9d401bf99e1aef0db` | Pro Device 1 Ultra | `SKU-FUR-0001` | Furniture | $18.84 | 24 | ✅ 100% Match |
| 2 | `6aba7ff9d401bf99e1aef0dc` | Pro Device 2 Ultra | `SKU-CLO-0002` | Clothing | $22.69 | 28 | ✅ 100% Match |
| 3 | `6aba7ff9d401bf99e1aef0dd` | Pro Device 3 Ultra | `SKU-BOO-0003` | Books | $26.54 | 32 | ✅ 100% Match |
| 4 | `6aba7ff9d401bf99e1aef0de` | Pro Device 4 Ultra | `SKU-HOM-0004` | Home & Garden | $30.39 | 36 | ✅ 100% Match |
| 5 | `6aba7ff9d401bf99e1aef0df` | Pro Device 5 Ultra | `SKU-SPO-0005` | Sports | $34.24 | 40 | ✅ 100% Match |
| 6 | `6aba7ff9d401bf99e1aef0e0` | Pro Device 6 Ultra | `SKU-TOY-0006` | Toys | $38.09 | 44 | ✅ 100% Match |
| 7 | `6aba7ff9d401bf99e1aef0e1` | Pro Device 7 Ultra | `SKU-GRO-0007` | Groceries | $41.94 | 0 | ✅ 100% Match |
| 8 | `6aba7ff9d401bf99e1aef0e2` | Pro Device 8 Ultra | `SKU-AUT-0008` | Automotive | $45.79 | 52 | ✅ 100% Match |
| 9 | `6aba7ff9d401bf99e1aef0e3` | Pro Device 9 Ultra | `SKU-BEA-0009` | Beauty | $49.64 | 56 | ✅ 100% Match |
| 10 | `6aba7ff9d401bf99e1aef0e4` | Pro Device 10 Ultra | `SKU-ELE-0010` | Electronics | $53.49 | 60 | ✅ 100% Match |
| 11 | `6aba7ff9d401bf99e1aef0e5` | Pro Device 11 Ultra | `SKU-FUR-0011` | Furniture | $57.34 | 64 | ✅ 100% Match |
| 12 | `6aba7ff9d401bf99e1aef0e6` | Pro Device 12 Ultra | `SKU-CLO-0012` | Clothing | $61.19 | 68 | ✅ 100% Match |
| 13 | `6aba7ff9d401bf99e1aef0e7` | Pro Device 13 Ultra | `SKU-BOO-0013` | Books | $65.04 | 72 | ✅ 100% Match |
| 14 | `6aba7ff9d401bf99e1aef0e8` | Pro Device 14 Ultra | `SKU-HOM-0014` | Home & Garden | $68.89 | 0 | ✅ 100% Match |
| 15 | `6aba7ff9d401bf99e1aef0e9` | Pro Device 15 Ultra | `SKU-SPO-0015` | Sports | $72.74 | 80 | ✅ 100% Match |
| 16 | `6aba7ff9d401bf99e1aef0ea` | Pro Device 16 Ultra | `SKU-TOY-0016` | Toys | $76.59 | 84 | ✅ 100% Match |
| 17 | `6aba7ff9d401bf99e1aef0eb` | Pro Device 17 Ultra | `SKU-GRO-0017` | Groceries | $80.44 | 88 | ✅ 100% Match |
| 18 | `6aba7ff9d401bf99e1aef0ec` | Pro Device 18 Ultra | `SKU-AUT-0018` | Automotive | $84.29 | 92 | ✅ 100% Match |
| 19 | `6aba7ff9d401bf99e1aef0ed` | Pro Device 19 Ultra | `SKU-BEA-0019` | Beauty | $88.14 | 96 | ✅ 100% Match |
| 20 | `6aba7ff9d401bf99e1aef0ee` | Pro Device 20 Ultra | `SKU-ELE-0020` | Electronics | $91.99 | 100 | ✅ 100% Match |
| 21 | `6aba7ff9d401bf99e1aef0ef` | Pro Device 21 Ultra | `SKU-FUR-0021` | Furniture | $95.84 | 0 | ✅ 100% Match |
| 22 | `6aba7ff9d401bf99e1aef0f0` | Pro Device 22 Ultra | `SKU-CLO-0022` | Clothing | $99.69 | 108 | ✅ 100% Match |
| 23 | `6aba7ff9d401bf99e1aef0f1` | Pro Device 23 Ultra | `SKU-BOO-0023` | Books | $103.54 | 112 | ✅ 100% Match |
| 24 | `6aba7ff9d401bf99e1aef0f2` | Pro Device 24 Ultra | `SKU-HOM-0024` | Home & Garden | $107.39 | 116 | ✅ 100% Match |
| 25 | `6aba7ff9d401bf99e1aef0f3` | Pro Device 25 Ultra | `SKU-SPO-0025` | Sports | $111.24 | 120 | ✅ 100% Match |
| 26 | `6aba7ff9d401bf99e1aef0f4` | Pro Device 26 Ultra | `SKU-TOY-0026` | Toys | $115.09 | 124 | ✅ 100% Match |
| 27 | `6aba7ff9d401bf99e1aef0f5` | Pro Device 27 Ultra | `SKU-GRO-0027` | Groceries | $118.94 | 128 | ✅ 100% Match |
| 28 | `6aba7ff9d401bf99e1aef0f6` | Pro Device 28 Ultra | `SKU-AUT-0028` | Automotive | $122.79 | 0 | ✅ 100% Match |
| 29 | `6aba7ff9d401bf99e1aef0f7` | Pro Device 29 Ultra | `SKU-BEA-0029` | Beauty | $126.64 | 136 | ✅ 100% Match |
| 30 | `6aba7ff9d401bf99e1aef0f8` | Pro Device 30 Ultra | `SKU-ELE-0030` | Electronics | $130.49 | 140 | ✅ 100% Match |
| 31 | `6aba7ff9d401bf99e1aef0f9` | Pro Device 31 Ultra | `SKU-FUR-0031` | Furniture | $134.34 | 144 | ✅ 100% Match |
| 32 | `6aba7ff9d401bf99e1aef0fa` | Pro Device 32 Ultra | `SKU-CLO-0032` | Clothing | $138.19 | 148 | ✅ 100% Match |
| 33 | `6aba7ff9d401bf99e1aef0fb` | Pro Device 33 Ultra | `SKU-BOO-0033` | Books | $142.04 | 152 | ✅ 100% Match |
| 34 | `6aba7ff9d401bf99e1aef0fc` | Pro Device 34 Ultra | `SKU-HOM-0034` | Home & Garden | $145.89 | 156 | ✅ 100% Match |
| 35 | `6aba7ff9d401bf99e1aef0fd` | Pro Device 35 Ultra | `SKU-SPO-0035` | Sports | $149.74 | 0 | ✅ 100% Match |
| 36 | `6aba7ff9d401bf99e1aef0fe` | Pro Device 36 Ultra | `SKU-TOY-0036` | Toys | $153.59 | 164 | ✅ 100% Match |
| 37 | `6aba7ff9d401bf99e1aef0ff` | Pro Device 37 Ultra | `SKU-GRO-0037` | Groceries | $157.44 | 168 | ✅ 100% Match |
| 38 | `6aba7ff9d401bf99e1aef100` | Pro Device 38 Ultra | `SKU-AUT-0038` | Automotive | $161.29 | 172 | ✅ 100% Match |
| 39 | `6aba7ff9d401bf99e1aef101` | Pro Device 39 Ultra | `SKU-BEA-0039` | Beauty | $165.14 | 176 | ✅ 100% Match |
| 40 | `6aba7ff9d401bf99e1aef102` | Pro Device 40 Ultra | `SKU-ELE-0040` | Electronics | $168.99 | 180 | ✅ 100% Match |
| 41 | `6aba7ff9d401bf99e1aef103` | Pro Device 41 Ultra | `SKU-FUR-0041` | Furniture | $172.84 | 184 | ✅ 100% Match |
| 42 | `6aba7ff9d401bf99e1aef104` | Pro Device 42 Ultra | `SKU-CLO-0042` | Clothing | $176.69 | 0 | ✅ 100% Match |
| 43 | `6aba7ff9d401bf99e1aef105` | Pro Device 43 Ultra | `SKU-BOO-0043` | Books | $180.54 | 192 | ✅ 100% Match |
| 44 | `6aba7ff9d401bf99e1aef106` | Pro Device 44 Ultra | `SKU-HOM-0044` | Home & Garden | $184.39 | 196 | ✅ 100% Match |
| 45 | `6aba7ff9d401bf99e1aef107` | Pro Device 45 Ultra | `SKU-SPO-0045` | Sports | $188.24 | 200 | ✅ 100% Match |
| 46 | `6aba7ff9d401bf99e1aef108` | Pro Device 46 Ultra | `SKU-TOY-0046` | Toys | $192.09 | 204 | ✅ 100% Match |
| 47 | `6aba7ff9d401bf99e1aef109` | Pro Device 47 Ultra | `SKU-GRO-0047` | Groceries | $195.94 | 208 | ✅ 100% Match |
| 48 | `6aba7ff9d401bf99e1aef10a` | Pro Device 48 Ultra | `SKU-AUT-0048` | Automotive | $199.79 | 212 | ✅ 100% Match |
| 49 | `6aba7ff9d401bf99e1aef10b` | Pro Device 49 Ultra | `SKU-BEA-0049` | Beauty | $203.64 | 0 | ✅ 100% Match |
| 50 | `6aba7ff9d401bf99e1aef10c` | Pro Device 50 Ultra | `SKU-ELE-0050` | Electronics | $207.49 | 220 | ✅ 100% Match |

## 4. Table: `payments` (All 100 Records Audited Individually)
| # | MongoDB ID | Transaction ID | Order Number | Amount | Fee | Net | Method | Status | Match Status |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---|:---|:---:|
| 1 | `6aba7ff9d401bf99e1aef171` | `TXN-MULDDW8W-0001` | `ORD-2026-00001` | $77.85 | $2.56 | $75.29 | paypal | succeeded | ✅ 100% Match |
| 2 | `6aba7ff9d401bf99e1aef172` | `TXN-MULDDW8W-0002` | `ORD-2026-00002` | $178.20 | $5.47 | $172.73 | apple_pay | succeeded | ✅ 100% Match |
| 3 | `6aba7ff9d401bf99e1aef173` | `TXN-MULDDW8W-0003` | `ORD-2026-00003` | $227.40 | $6.89 | $220.51 | stripe | succeeded | ✅ 100% Match |
| 4 | `6aba7ff9d401bf99e1aef174` | `TXN-MULDDW8W-0004` | `ORD-2026-00004` | $31.20 | $1.20 | $30.00 | credit_card | succeeded | ✅ 100% Match |
| 5 | `6aba7ff9d401bf99e1aef175` | `TXN-MULDDW8W-0005` | `ORD-2026-00005` | $104.85 | $3.34 | $101.51 | paypal | succeeded | ✅ 100% Match |
| 6 | `6aba7ff9d401bf99e1aef176` | `TXN-MULDDW8W-0006` | `ORD-2026-00006` | $232.20 | $7.03 | $225.17 | apple_pay | succeeded | ✅ 100% Match |
| 7 | `6aba7ff9d401bf99e1aef177` | `TXN-MULDDW8W-0007` | `ORD-2026-00007` | $290.40 | $8.72 | $281.68 | stripe | succeeded | ✅ 100% Match |
| 8 | `6aba7ff9d401bf99e1aef178` | `TXN-MULDDW8W-0008` | `ORD-2026-00008` | $40.20 | $1.47 | $38.73 | credit_card | succeeded | ✅ 100% Match |
| 9 | `6aba7ff9d401bf99e1aef179` | `TXN-MULDDW8W-0009` | `ORD-2026-00009` | $131.85 | $4.12 | $127.73 | paypal | succeeded | ✅ 100% Match |
| 10 | `6aba7ff9d401bf99e1aef17a` | `TXN-MULDDW8W-0010` | `ORD-2026-00010` | $286.20 | $8.60 | $277.60 | apple_pay | succeeded | ✅ 100% Match |
| 11 | `6aba7ff9d401bf99e1aef17b` | `TXN-MULDDW8W-0011` | `ORD-2026-00011` | $353.40 | $10.55 | $342.85 | stripe | succeeded | ✅ 100% Match |
| 12 | `6aba7ff9d401bf99e1aef17c` | `TXN-MULDDW8W-0012` | `ORD-2026-00012` | $49.20 | $1.73 | $47.47 | credit_card | succeeded | ✅ 100% Match |
| 13 | `6aba7ff9d401bf99e1aef17d` | `TXN-MULDDW8W-0013` | `ORD-2026-00013` | $158.85 | $4.91 | $153.94 | paypal | succeeded | ✅ 100% Match |
| 14 | `6aba7ff9d401bf99e1aef17e` | `TXN-MULDDW8W-0014` | `ORD-2026-00014` | $340.20 | $10.17 | $330.03 | apple_pay | succeeded | ✅ 100% Match |
| 15 | `6aba7ff9d401bf99e1aef17f` | `TXN-MULDDW8W-0015` | `ORD-2026-00015` | $416.40 | $12.38 | $404.02 | stripe | refunded | ✅ 100% Match |
| 16 | `6aba7ff9d401bf99e1aef180` | `TXN-MULDDW8W-0016` | `ORD-2026-00016` | $58.20 | $1.99 | $56.21 | credit_card | succeeded | ✅ 100% Match |
| 17 | `6aba7ff9d401bf99e1aef181` | `TXN-MULDDW8W-0017` | `ORD-2026-00017` | $185.85 | $5.69 | $180.16 | paypal | succeeded | ✅ 100% Match |
| 18 | `6aba7ff9d401bf99e1aef182` | `TXN-MULDDW8W-0018` | `ORD-2026-00018` | $394.20 | $11.73 | $382.47 | apple_pay | succeeded | ✅ 100% Match |
| 19 | `6aba7ff9d401bf99e1aef183` | `TXN-MULDDW8W-0019` | `ORD-2026-00019` | $479.40 | $14.20 | $465.20 | stripe | succeeded | ✅ 100% Match |
| 20 | `6aba7ff9d401bf99e1aef184` | `TXN-MULDDW8W-0020` | `ORD-2026-00020` | $67.20 | $2.25 | $64.95 | credit_card | pending | ✅ 100% Match |
| 21 | `6aba7ff9d401bf99e1aef185` | `TXN-MULDDW8W-0021` | `ORD-2026-00021` | $212.85 | $6.47 | $206.38 | paypal | succeeded | ✅ 100% Match |
| 22 | `6aba7ff9d401bf99e1aef186` | `TXN-MULDDW8W-0022` | `ORD-2026-00022` | $448.20 | $13.30 | $434.90 | apple_pay | succeeded | ✅ 100% Match |
| 23 | `6aba7ff9d401bf99e1aef187` | `TXN-MULDDW8W-0023` | `ORD-2026-00023` | $542.40 | $16.03 | $526.37 | stripe | succeeded | ✅ 100% Match |
| 24 | `6aba7ff9d401bf99e1aef188` | `TXN-MULDDW8W-0024` | `ORD-2026-00024` | $76.20 | $2.51 | $73.69 | credit_card | succeeded | ✅ 100% Match |
| 25 | `6aba7ff9d401bf99e1aef189` | `TXN-MULDDW8W-0025` | `ORD-2026-00025` | $239.85 | $7.26 | $232.59 | paypal | succeeded | ✅ 100% Match |
| 26 | `6aba7ff9d401bf99e1aef18a` | `TXN-MULDDW8W-0026` | `ORD-2026-00026` | $502.20 | $14.86 | $487.34 | apple_pay | succeeded | ✅ 100% Match |
| 27 | `6aba7ff9d401bf99e1aef18b` | `TXN-MULDDW8W-0027` | `ORD-2026-00027` | $605.40 | $17.86 | $587.54 | stripe | succeeded | ✅ 100% Match |
| 28 | `6aba7ff9d401bf99e1aef18c` | `TXN-MULDDW8W-0028` | `ORD-2026-00028` | $85.20 | $2.77 | $82.43 | credit_card | succeeded | ✅ 100% Match |
| 29 | `6aba7ff9d401bf99e1aef18d` | `TXN-MULDDW8W-0029` | `ORD-2026-00029` | $266.85 | $8.04 | $258.81 | paypal | succeeded | ✅ 100% Match |
| 30 | `6aba7ff9d401bf99e1aef18e` | `TXN-MULDDW8W-0030` | `ORD-2026-00030` | $556.20 | $16.43 | $539.77 | apple_pay | refunded | ✅ 100% Match |
| 31 | `6aba7ff9d401bf99e1aef18f` | `TXN-MULDDW8W-0031` | `ORD-2026-00031` | $668.40 | $19.68 | $648.72 | stripe | succeeded | ✅ 100% Match |
| 32 | `6aba7ff9d401bf99e1aef190` | `TXN-MULDDW8W-0032` | `ORD-2026-00032` | $94.20 | $3.03 | $91.17 | credit_card | succeeded | ✅ 100% Match |
| 33 | `6aba7ff9d401bf99e1aef191` | `TXN-MULDDW8W-0033` | `ORD-2026-00033` | $293.85 | $8.82 | $285.03 | paypal | succeeded | ✅ 100% Match |
| 34 | `6aba7ff9d401bf99e1aef192` | `TXN-MULDDW8W-0034` | `ORD-2026-00034` | $610.20 | $18.00 | $592.20 | apple_pay | succeeded | ✅ 100% Match |
| 35 | `6aba7ff9d401bf99e1aef193` | `TXN-MULDDW8W-0035` | `ORD-2026-00035` | $731.40 | $21.51 | $709.89 | stripe | succeeded | ✅ 100% Match |
| 36 | `6aba7ff9d401bf99e1aef194` | `TXN-MULDDW8X-0036` | `ORD-2026-00036` | $103.20 | $3.29 | $99.91 | credit_card | succeeded | ✅ 100% Match |
| 37 | `6aba7ff9d401bf99e1aef195` | `TXN-MULDDW8X-0037` | `ORD-2026-00037` | $320.85 | $9.60 | $311.25 | paypal | succeeded | ✅ 100% Match |
| 38 | `6aba7ff9d401bf99e1aef196` | `TXN-MULDDW8X-0038` | `ORD-2026-00038` | $664.20 | $19.56 | $644.64 | apple_pay | succeeded | ✅ 100% Match |
| 39 | `6aba7ff9d401bf99e1aef197` | `TXN-MULDDW8X-0039` | `ORD-2026-00039` | $794.40 | $23.34 | $771.06 | stripe | succeeded | ✅ 100% Match |
| 40 | `6aba7ff9d401bf99e1aef198` | `TXN-MULDDW8X-0040` | `ORD-2026-00040` | $112.20 | $3.55 | $108.65 | credit_card | pending | ✅ 100% Match |
| 41 | `6aba7ff9d401bf99e1aef199` | `TXN-MULDDW8X-0041` | `ORD-2026-00041` | $347.85 | $10.39 | $337.46 | paypal | succeeded | ✅ 100% Match |
| 42 | `6aba7ff9d401bf99e1aef19a` | `TXN-MULDDW8X-0042` | `ORD-2026-00042` | $718.20 | $21.13 | $697.07 | apple_pay | succeeded | ✅ 100% Match |
| 43 | `6aba7ff9d401bf99e1aef19b` | `TXN-MULDDW8X-0043` | `ORD-2026-00043` | $857.40 | $25.16 | $832.24 | stripe | succeeded | ✅ 100% Match |
| 44 | `6aba7ff9d401bf99e1aef19c` | `TXN-MULDDW8X-0044` | `ORD-2026-00044` | $121.20 | $3.81 | $117.39 | credit_card | succeeded | ✅ 100% Match |
| 45 | `6aba7ff9d401bf99e1aef19d` | `TXN-MULDDW8X-0045` | `ORD-2026-00045` | $374.85 | $11.17 | $363.68 | paypal | refunded | ✅ 100% Match |
| 46 | `6aba7ff9d401bf99e1aef19e` | `TXN-MULDDW8X-0046` | `ORD-2026-00046` | $772.20 | $22.69 | $749.51 | apple_pay | succeeded | ✅ 100% Match |
| 47 | `6aba7ff9d401bf99e1aef19f` | `TXN-MULDDW8X-0047` | `ORD-2026-00047` | $807.90 | $23.73 | $784.17 | stripe | succeeded | ✅ 100% Match |
| 48 | `6aba7ff9d401bf99e1aef1a0` | `TXN-MULDDW8X-0048` | `ORD-2026-00048` | $130.20 | $4.08 | $126.12 | credit_card | succeeded | ✅ 100% Match |
| 49 | `6aba7ff9d401bf99e1aef1a1` | `TXN-MULDDW8X-0049` | `ORD-2026-00049` | $176.85 | $5.43 | $171.42 | paypal | succeeded | ✅ 100% Match |
| 50 | `6aba7ff9d401bf99e1aef1a2` | `TXN-MULDDW8X-0050` | `ORD-2026-00050` | $151.20 | $4.68 | $146.52 | apple_pay | succeeded | ✅ 100% Match |
| 51 | `6aba7ff9d401bf99e1aef1a3` | `TXN-MULDDW8X-0051` | `ORD-2026-00051` | $195.90 | $5.98 | $189.92 | stripe | succeeded | ✅ 100% Match |
| 52 | `6aba7ff9d401bf99e1aef1a4` | `TXN-MULDDW8X-0052` | `ORD-2026-00052` | $26.70 | $1.07 | $25.63 | credit_card | succeeded | ✅ 100% Match |
| 53 | `6aba7ff9d401bf99e1aef1a5` | `TXN-MULDDW8X-0053` | `ORD-2026-00053` | $91.35 | $2.95 | $88.40 | paypal | succeeded | ✅ 100% Match |
| 54 | `6aba7ff9d401bf99e1aef1a6` | `TXN-MULDDW8X-0054` | `ORD-2026-00054` | $205.20 | $6.25 | $198.95 | apple_pay | succeeded | ✅ 100% Match |
| 55 | `6aba7ff9d401bf99e1aef1a7` | `TXN-MULDDW8X-0055` | `ORD-2026-00055` | $258.90 | $7.81 | $251.09 | stripe | succeeded | ✅ 100% Match |
| 56 | `6aba7ff9d401bf99e1aef1a8` | `TXN-MULDDW8X-0056` | `ORD-2026-00056` | $35.70 | $1.34 | $34.36 | credit_card | succeeded | ✅ 100% Match |
| 57 | `6aba7ff9d401bf99e1aef1a9` | `TXN-MULDDW8X-0057` | `ORD-2026-00057` | $118.35 | $3.73 | $114.62 | paypal | succeeded | ✅ 100% Match |
| 58 | `6aba7ff9d401bf99e1aef1aa` | `TXN-MULDDW8X-0058` | `ORD-2026-00058` | $259.20 | $7.82 | $251.38 | apple_pay | succeeded | ✅ 100% Match |
| 59 | `6aba7ff9d401bf99e1aef1ab` | `TXN-MULDDW8X-0059` | `ORD-2026-00059` | $321.90 | $9.64 | $312.26 | stripe | succeeded | ✅ 100% Match |
| 60 | `6aba7ff9d401bf99e1aef1ac` | `TXN-MULDDW8X-0060` | `ORD-2026-00060` | $44.70 | $1.60 | $43.10 | credit_card | refunded | ✅ 100% Match |
| 61 | `6aba7ff9d401bf99e1aef1ad` | `TXN-MULDDW8X-0061` | `ORD-2026-00061` | $145.35 | $4.52 | $140.83 | paypal | succeeded | ✅ 100% Match |
| 62 | `6aba7ff9d401bf99e1aef1ae` | `TXN-MULDDW8X-0062` | `ORD-2026-00062` | $313.20 | $9.38 | $303.82 | apple_pay | succeeded | ✅ 100% Match |
| 63 | `6aba7ff9d401bf99e1aef1af` | `TXN-MULDDW8X-0063` | `ORD-2026-00063` | $384.90 | $11.46 | $373.44 | stripe | succeeded | ✅ 100% Match |
| 64 | `6aba7ff9d401bf99e1aef1b0` | `TXN-MULDDW8X-0064` | `ORD-2026-00064` | $53.70 | $1.86 | $51.84 | credit_card | succeeded | ✅ 100% Match |
| 65 | `6aba7ff9d401bf99e1aef1b1` | `TXN-MULDDW8X-0065` | `ORD-2026-00065` | $172.35 | $5.30 | $167.05 | paypal | succeeded | ✅ 100% Match |
| 66 | `6aba7ff9d401bf99e1aef1b2` | `TXN-MULDDW8X-0066` | `ORD-2026-00066` | $367.20 | $10.95 | $356.25 | apple_pay | succeeded | ✅ 100% Match |
| 67 | `6aba7ff9d401bf99e1aef1b3` | `TXN-MULDDW8X-0067` | `ORD-2026-00067` | $447.90 | $13.29 | $434.61 | stripe | succeeded | ✅ 100% Match |
| 68 | `6aba7ff9d401bf99e1aef1b4` | `TXN-MULDDW8X-0068` | `ORD-2026-00068` | $62.70 | $2.12 | $60.58 | credit_card | succeeded | ✅ 100% Match |
| 69 | `6aba7ff9d401bf99e1aef1b5` | `TXN-MULDDW8X-0069` | `ORD-2026-00069` | $199.35 | $6.08 | $193.27 | paypal | succeeded | ✅ 100% Match |
| 70 | `6aba7ff9d401bf99e1aef1b6` | `TXN-MULDDW8X-0070` | `ORD-2026-00070` | $421.20 | $12.51 | $408.69 | apple_pay | succeeded | ✅ 100% Match |
| 71 | `6aba7ff9d401bf99e1aef1b7` | `TXN-MULDDW8X-0071` | `ORD-2026-00071` | $510.90 | $15.12 | $495.78 | stripe | succeeded | ✅ 100% Match |
| 72 | `6aba7ff9d401bf99e1aef1b8` | `TXN-MULDDW8X-0072` | `ORD-2026-00072` | $71.70 | $2.38 | $69.32 | credit_card | succeeded | ✅ 100% Match |
| 73 | `6aba7ff9d401bf99e1aef1b9` | `TXN-MULDDW8X-0073` | `ORD-2026-00073` | $226.35 | $6.86 | $219.49 | paypal | succeeded | ✅ 100% Match |
| 74 | `6aba7ff9d401bf99e1aef1ba` | `TXN-MULDDW8X-0074` | `ORD-2026-00074` | $475.20 | $14.08 | $461.12 | apple_pay | succeeded | ✅ 100% Match |
| 75 | `6aba7ff9d401bf99e1aef1bb` | `TXN-MULDDW8X-0075` | `ORD-2026-00075` | $573.90 | $16.94 | $556.96 | stripe | refunded | ✅ 100% Match |
| 76 | `6aba7ff9d401bf99e1aef1bc` | `TXN-MULDDW8X-0076` | `ORD-2026-00076` | $80.70 | $2.64 | $78.06 | credit_card | succeeded | ✅ 100% Match |
| 77 | `6aba7ff9d401bf99e1aef1bd` | `TXN-MULDDW8X-0077` | `ORD-2026-00077` | $253.35 | $7.65 | $245.70 | paypal | succeeded | ✅ 100% Match |
| 78 | `6aba7ff9d401bf99e1aef1be` | `TXN-MULDDW8X-0078` | `ORD-2026-00078` | $529.20 | $15.65 | $513.55 | apple_pay | succeeded | ✅ 100% Match |
| 79 | `6aba7ff9d401bf99e1aef1bf` | `TXN-MULDDW8X-0079` | `ORD-2026-00079` | $636.90 | $18.77 | $618.13 | stripe | succeeded | ✅ 100% Match |
| 80 | `6aba7ff9d401bf99e1aef1c0` | `TXN-MULDDW8X-0080` | `ORD-2026-00080` | $89.70 | $2.90 | $86.80 | credit_card | pending | ✅ 100% Match |
| 81 | `6aba7ff9d401bf99e1aef1c1` | `TXN-MULDDW8X-0081` | `ORD-2026-00081` | $280.35 | $8.43 | $271.92 | paypal | succeeded | ✅ 100% Match |
| 82 | `6aba7ff9d401bf99e1aef1c2` | `TXN-MULDDW8X-0082` | `ORD-2026-00082` | $583.20 | $17.21 | $565.99 | apple_pay | succeeded | ✅ 100% Match |
| 83 | `6aba7ff9d401bf99e1aef1c3` | `TXN-MULDDW8X-0083` | `ORD-2026-00083` | $699.90 | $20.60 | $679.30 | stripe | succeeded | ✅ 100% Match |
| 84 | `6aba7ff9d401bf99e1aef1c4` | `TXN-MULDDW8X-0084` | `ORD-2026-00084` | $98.70 | $3.16 | $95.54 | credit_card | succeeded | ✅ 100% Match |
| 85 | `6aba7ff9d401bf99e1aef1c5` | `TXN-MULDDW8X-0085` | `ORD-2026-00085` | $307.35 | $9.21 | $298.14 | paypal | succeeded | ✅ 100% Match |
| 86 | `6aba7ff9d401bf99e1aef1c6` | `TXN-MULDDW8X-0086` | `ORD-2026-00086` | $637.20 | $18.78 | $618.42 | apple_pay | succeeded | ✅ 100% Match |
| 87 | `6aba7ff9d401bf99e1aef1c7` | `TXN-MULDDW8X-0087` | `ORD-2026-00087` | $762.90 | $22.42 | $740.48 | stripe | succeeded | ✅ 100% Match |
| 88 | `6aba7ff9d401bf99e1aef1c8` | `TXN-MULDDW8X-0088` | `ORD-2026-00088` | $107.70 | $3.42 | $104.28 | credit_card | succeeded | ✅ 100% Match |
| 89 | `6aba7ff9d401bf99e1aef1c9` | `TXN-MULDDW8X-0089` | `ORD-2026-00089` | $334.35 | $10.00 | $324.35 | paypal | succeeded | ✅ 100% Match |
| 90 | `6aba7ff9d401bf99e1aef1ca` | `TXN-MULDDW8X-0090` | `ORD-2026-00090` | $691.20 | $20.34 | $670.86 | apple_pay | refunded | ✅ 100% Match |
| 91 | `6aba7ff9d401bf99e1aef1cb` | `TXN-MULDDW8X-0091` | `ORD-2026-00091` | $825.90 | $24.25 | $801.65 | stripe | succeeded | ✅ 100% Match |
| 92 | `6aba7ff9d401bf99e1aef1cc` | `TXN-MULDDW8X-0092` | `ORD-2026-00092` | $116.70 | $3.68 | $113.02 | credit_card | succeeded | ✅ 100% Match |
| 93 | `6aba7ff9d401bf99e1aef1cd` | `TXN-MULDDW8X-0093` | `ORD-2026-00093` | $361.35 | $10.78 | $350.57 | paypal | succeeded | ✅ 100% Match |
| 94 | `6aba7ff9d401bf99e1aef1ce` | `TXN-MULDDW8X-0094` | `ORD-2026-00094` | $745.20 | $21.91 | $723.29 | apple_pay | succeeded | ✅ 100% Match |
| 95 | `6aba7ff9d401bf99e1aef1cf` | `TXN-MULDDW8X-0095` | `ORD-2026-00095` | $888.90 | $26.08 | $862.82 | stripe | succeeded | ✅ 100% Match |
| 96 | `6aba7ff9d401bf99e1aef1d0` | `TXN-MULDDW8X-0096` | `ORD-2026-00096` | $125.70 | $3.95 | $121.75 | credit_card | succeeded | ✅ 100% Match |
| 97 | `6aba7ff9d401bf99e1aef1d1` | `TXN-MULDDW8X-0097` | `ORD-2026-00097` | $388.35 | $11.56 | $376.79 | paypal | succeeded | ✅ 100% Match |
| 98 | `6aba7ff9d401bf99e1aef1d2` | `TXN-MULDDW8X-0098` | `ORD-2026-00098` | $461.70 | $13.69 | $448.01 | apple_pay | succeeded | ✅ 100% Match |
| 99 | `6aba7ff9d401bf99e1aef1d3` | `TXN-MULDDW8X-0099` | `ORD-2026-00099` | $276.90 | $8.33 | $268.57 | stripe | succeeded | ✅ 100% Match |
| 100 | `6aba7ff9d401bf99e1aef1d4` | `TXN-MULDDW8X-0100` | `ORD-2026-00100` | $22.20 | $0.94 | $21.26 | credit_card | pending | ✅ 100% Match |

## 5. Table: `orders` & `orders_items` (All 100 Orders & 250 Normalized Items)
| # | Order ID | Order Number | Customer Email | Total Amount | Items Count | Child Items in PG | Sequence Valid | Match Status |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | `6aba7ff9d401bf99e1aef10d` | `ORD-2026-00001` | customer2@migrateiq-test.org | $77.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 2 | `6aba7ff9d401bf99e1aef10e` | `ORD-2026-00002` | customer3@migrateiq-test.org | $178.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 3 | `6aba7ff9d401bf99e1aef10f` | `ORD-2026-00003` | customer4@migrateiq-test.org | $227.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 4 | `6aba7ff9d401bf99e1aef110` | `ORD-2026-00004` | customer5@migrateiq-test.org | $31.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 5 | `6aba7ff9d401bf99e1aef111` | `ORD-2026-00005` | customer6@migrateiq-test.org | $104.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 6 | `6aba7ff9d401bf99e1aef112` | `ORD-2026-00006` | customer7@migrateiq-test.org | $232.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 7 | `6aba7ff9d401bf99e1aef113` | `ORD-2026-00007` | customer8@migrateiq-test.org | $290.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 8 | `6aba7ff9d401bf99e1aef114` | `ORD-2026-00008` | customer9@migrateiq-test.org | $40.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 9 | `6aba7ff9d401bf99e1aef115` | `ORD-2026-00009` | customer10@migrateiq-test.org | $131.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 10 | `6aba7ff9d401bf99e1aef116` | `ORD-2026-00010` | customer11@migrateiq-test.org | $286.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 11 | `6aba7ff9d401bf99e1aef117` | `ORD-2026-00011` | customer12@migrateiq-test.org | $353.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 12 | `6aba7ff9d401bf99e1aef118` | `ORD-2026-00012` | customer13@migrateiq-test.org | $49.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 13 | `6aba7ff9d401bf99e1aef119` | `ORD-2026-00013` | customer14@migrateiq-test.org | $158.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 14 | `6aba7ff9d401bf99e1aef11a` | `ORD-2026-00014` | customer15@migrateiq-test.org | $340.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 15 | `6aba7ff9d401bf99e1aef11b` | `ORD-2026-00015` | customer16@migrateiq-test.org | $416.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 16 | `6aba7ff9d401bf99e1aef11c` | `ORD-2026-00016` | customer17@migrateiq-test.org | $58.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 17 | `6aba7ff9d401bf99e1aef11d` | `ORD-2026-00017` | customer18@migrateiq-test.org | $185.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 18 | `6aba7ff9d401bf99e1aef11e` | `ORD-2026-00018` | customer19@migrateiq-test.org | $394.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 19 | `6aba7ff9d401bf99e1aef11f` | `ORD-2026-00019` | customer20@migrateiq-test.org | $479.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 20 | `6aba7ff9d401bf99e1aef120` | `ORD-2026-00020` | customer21@migrateiq-test.org | $67.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 21 | `6aba7ff9d401bf99e1aef121` | `ORD-2026-00021` | customer22@migrateiq-test.org | $212.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 22 | `6aba7ff9d401bf99e1aef122` | `ORD-2026-00022` | customer23@migrateiq-test.org | $448.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 23 | `6aba7ff9d401bf99e1aef123` | `ORD-2026-00023` | customer24@migrateiq-test.org | $542.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 24 | `6aba7ff9d401bf99e1aef124` | `ORD-2026-00024` | customer25@migrateiq-test.org | $76.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 25 | `6aba7ff9d401bf99e1aef125` | `ORD-2026-00025` | customer26@migrateiq-test.org | $239.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 26 | `6aba7ff9d401bf99e1aef126` | `ORD-2026-00026` | customer27@migrateiq-test.org | $502.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 27 | `6aba7ff9d401bf99e1aef127` | `ORD-2026-00027` | customer28@migrateiq-test.org | $605.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 28 | `6aba7ff9d401bf99e1aef128` | `ORD-2026-00028` | customer29@migrateiq-test.org | $85.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 29 | `6aba7ff9d401bf99e1aef129` | `ORD-2026-00029` | customer30@migrateiq-test.org | $266.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 30 | `6aba7ff9d401bf99e1aef12a` | `ORD-2026-00030` | customer31@migrateiq-test.org | $556.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 31 | `6aba7ff9d401bf99e1aef12b` | `ORD-2026-00031` | customer32@migrateiq-test.org | $668.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 32 | `6aba7ff9d401bf99e1aef12c` | `ORD-2026-00032` | customer33@migrateiq-test.org | $94.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 33 | `6aba7ff9d401bf99e1aef12d` | `ORD-2026-00033` | customer34@migrateiq-test.org | $293.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 34 | `6aba7ff9d401bf99e1aef12e` | `ORD-2026-00034` | customer35@migrateiq-test.org | $610.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 35 | `6aba7ff9d401bf99e1aef12f` | `ORD-2026-00035` | customer36@migrateiq-test.org | $731.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 36 | `6aba7ff9d401bf99e1aef130` | `ORD-2026-00036` | customer37@migrateiq-test.org | $103.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 37 | `6aba7ff9d401bf99e1aef131` | `ORD-2026-00037` | customer38@migrateiq-test.org | $320.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 38 | `6aba7ff9d401bf99e1aef132` | `ORD-2026-00038` | customer39@migrateiq-test.org | $664.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 39 | `6aba7ff9d401bf99e1aef133` | `ORD-2026-00039` | customer40@migrateiq-test.org | $794.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 40 | `6aba7ff9d401bf99e1aef134` | `ORD-2026-00040` | customer41@migrateiq-test.org | $112.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 41 | `6aba7ff9d401bf99e1aef135` | `ORD-2026-00041` | customer42@migrateiq-test.org | $347.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 42 | `6aba7ff9d401bf99e1aef136` | `ORD-2026-00042` | customer43@migrateiq-test.org | $718.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 43 | `6aba7ff9d401bf99e1aef137` | `ORD-2026-00043` | customer44@migrateiq-test.org | $857.40 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 44 | `6aba7ff9d401bf99e1aef138` | `ORD-2026-00044` | customer45@migrateiq-test.org | $121.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 45 | `6aba7ff9d401bf99e1aef139` | `ORD-2026-00045` | customer46@migrateiq-test.org | $374.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 46 | `6aba7ff9d401bf99e1aef13a` | `ORD-2026-00046` | customer47@migrateiq-test.org | $772.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 47 | `6aba7ff9d401bf99e1aef13b` | `ORD-2026-00047` | customer48@migrateiq-test.org | $807.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 48 | `6aba7ff9d401bf99e1aef13c` | `ORD-2026-00048` | customer49@migrateiq-test.org | $130.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 49 | `6aba7ff9d401bf99e1aef13d` | `ORD-2026-00049` | customer50@migrateiq-test.org | $176.85 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 50 | `6aba7ff9d401bf99e1aef13e` | `ORD-2026-00050` | customer1@migrateiq-test.org | $151.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 51 | `6aba7ff9d401bf99e1aef13f` | `ORD-2026-00051` | customer2@migrateiq-test.org | $195.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 52 | `6aba7ff9d401bf99e1aef140` | `ORD-2026-00052` | customer3@migrateiq-test.org | $26.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 53 | `6aba7ff9d401bf99e1aef141` | `ORD-2026-00053` | customer4@migrateiq-test.org | $91.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 54 | `6aba7ff9d401bf99e1aef142` | `ORD-2026-00054` | customer5@migrateiq-test.org | $205.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 55 | `6aba7ff9d401bf99e1aef143` | `ORD-2026-00055` | customer6@migrateiq-test.org | $258.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 56 | `6aba7ff9d401bf99e1aef144` | `ORD-2026-00056` | customer7@migrateiq-test.org | $35.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 57 | `6aba7ff9d401bf99e1aef145` | `ORD-2026-00057` | customer8@migrateiq-test.org | $118.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 58 | `6aba7ff9d401bf99e1aef146` | `ORD-2026-00058` | customer9@migrateiq-test.org | $259.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 59 | `6aba7ff9d401bf99e1aef147` | `ORD-2026-00059` | customer10@migrateiq-test.org | $321.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 60 | `6aba7ff9d401bf99e1aef148` | `ORD-2026-00060` | customer11@migrateiq-test.org | $44.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 61 | `6aba7ff9d401bf99e1aef149` | `ORD-2026-00061` | customer12@migrateiq-test.org | $145.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 62 | `6aba7ff9d401bf99e1aef14a` | `ORD-2026-00062` | customer13@migrateiq-test.org | $313.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 63 | `6aba7ff9d401bf99e1aef14b` | `ORD-2026-00063` | customer14@migrateiq-test.org | $384.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 64 | `6aba7ff9d401bf99e1aef14c` | `ORD-2026-00064` | customer15@migrateiq-test.org | $53.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 65 | `6aba7ff9d401bf99e1aef14d` | `ORD-2026-00065` | customer16@migrateiq-test.org | $172.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 66 | `6aba7ff9d401bf99e1aef14e` | `ORD-2026-00066` | customer17@migrateiq-test.org | $367.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 67 | `6aba7ff9d401bf99e1aef14f` | `ORD-2026-00067` | customer18@migrateiq-test.org | $447.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 68 | `6aba7ff9d401bf99e1aef150` | `ORD-2026-00068` | customer19@migrateiq-test.org | $62.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 69 | `6aba7ff9d401bf99e1aef151` | `ORD-2026-00069` | customer20@migrateiq-test.org | $199.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 70 | `6aba7ff9d401bf99e1aef152` | `ORD-2026-00070` | customer21@migrateiq-test.org | $421.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 71 | `6aba7ff9d401bf99e1aef153` | `ORD-2026-00071` | customer22@migrateiq-test.org | $510.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 72 | `6aba7ff9d401bf99e1aef154` | `ORD-2026-00072` | customer23@migrateiq-test.org | $71.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 73 | `6aba7ff9d401bf99e1aef155` | `ORD-2026-00073` | customer24@migrateiq-test.org | $226.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 74 | `6aba7ff9d401bf99e1aef156` | `ORD-2026-00074` | customer25@migrateiq-test.org | $475.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 75 | `6aba7ff9d401bf99e1aef157` | `ORD-2026-00075` | customer26@migrateiq-test.org | $573.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 76 | `6aba7ff9d401bf99e1aef158` | `ORD-2026-00076` | customer27@migrateiq-test.org | $80.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 77 | `6aba7ff9d401bf99e1aef159` | `ORD-2026-00077` | customer28@migrateiq-test.org | $253.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 78 | `6aba7ff9d401bf99e1aef15a` | `ORD-2026-00078` | customer29@migrateiq-test.org | $529.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 79 | `6aba7ff9d401bf99e1aef15b` | `ORD-2026-00079` | customer30@migrateiq-test.org | $636.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 80 | `6aba7ff9d401bf99e1aef15c` | `ORD-2026-00080` | customer31@migrateiq-test.org | $89.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 81 | `6aba7ff9d401bf99e1aef15d` | `ORD-2026-00081` | customer32@migrateiq-test.org | $280.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 82 | `6aba7ff9d401bf99e1aef15e` | `ORD-2026-00082` | customer33@migrateiq-test.org | $583.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 83 | `6aba7ff9d401bf99e1aef15f` | `ORD-2026-00083` | customer34@migrateiq-test.org | $699.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 84 | `6aba7ff9d401bf99e1aef160` | `ORD-2026-00084` | customer35@migrateiq-test.org | $98.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 85 | `6aba7ff9d401bf99e1aef161` | `ORD-2026-00085` | customer36@migrateiq-test.org | $307.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 86 | `6aba7ff9d401bf99e1aef162` | `ORD-2026-00086` | customer37@migrateiq-test.org | $637.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 87 | `6aba7ff9d401bf99e1aef163` | `ORD-2026-00087` | customer38@migrateiq-test.org | $762.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 88 | `6aba7ff9d401bf99e1aef164` | `ORD-2026-00088` | customer39@migrateiq-test.org | $107.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 89 | `6aba7ff9d401bf99e1aef165` | `ORD-2026-00089` | customer40@migrateiq-test.org | $334.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 90 | `6aba7ff9d401bf99e1aef166` | `ORD-2026-00090` | customer41@migrateiq-test.org | $691.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 91 | `6aba7ff9d401bf99e1aef167` | `ORD-2026-00091` | customer42@migrateiq-test.org | $825.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 92 | `6aba7ff9d401bf99e1aef168` | `ORD-2026-00092` | customer43@migrateiq-test.org | $116.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 93 | `6aba7ff9d401bf99e1aef169` | `ORD-2026-00093` | customer44@migrateiq-test.org | $361.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 94 | `6aba7ff9d401bf99e1aef16a` | `ORD-2026-00094` | customer45@migrateiq-test.org | $745.20 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 95 | `6aba7ff9d401bf99e1aef16b` | `ORD-2026-00095` | customer46@migrateiq-test.org | $888.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 96 | `6aba7ff9d401bf99e1aef16c` | `ORD-2026-00096` | customer47@migrateiq-test.org | $125.70 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |
| 97 | `6aba7ff9d401bf99e1aef16d` | `ORD-2026-00097` | customer48@migrateiq-test.org | $388.35 | 2 | 2 | Yes (0..N-1) | ✅ 100% Match |
| 98 | `6aba7ff9d401bf99e1aef16e` | `ORD-2026-00098` | customer49@migrateiq-test.org | $461.70 | 3 | 3 | Yes (0..N-1) | ✅ 100% Match |
| 99 | `6aba7ff9d401bf99e1aef16f` | `ORD-2026-00099` | customer50@migrateiq-test.org | $276.90 | 4 | 4 | Yes (0..N-1) | ✅ 100% Match |
| 100 | `6aba7ff9d401bf99e1aef170` | `ORD-2026-00100` | customer1@migrateiq-test.org | $22.20 | 1 | 1 | Yes (0..N-1) | ✅ 100% Match |

---
## 🏆 SUMMARY OF EXHAUSTIVE MANUAL RECORD-BY-RECORD AUDIT
- **Total Users Audited:** 50 / 50 (100% MATCH)
- **Total Categories Audited:** 10 / 10 (100% MATCH)
- **Total Products Audited:** 50 / 50 (100% MATCH)
- **Total Payments Audited:** 100 / 100 (100% MATCH)
- **Total Orders Audited:** 100 / 100 (100% MATCH)
- **Total Child Order Items Audited:** 250 / 250 (100% MATCH)
- **Total Entities Individually Checked:** 560 / 560
- **Total Discrepancies or Missing Records Found:** 0
- **Final Result:** 100.0000% BIT-PERFECT MIGRATION CONFIRMED.