# MigrateIQ — Complete Presentation Speaking Guide
### What to say, slide by slide + Panel Q&A

---

> **How to use this file:**
> - The **"What to Say"** section is your speaking script — say it naturally, don't read word-for-word.
> - The **"What This Slide Means"** section is your own understanding — know it, don't recite it.
> - The **"Panel Q&A"** section covers every possible question a teacher or examiner might ask.

---

---

# SLIDE 1 — Title Slide

## What to Say (Opening — 45 seconds)

*Start confidently. Look at the panel. Smile.*

> "Good morning/afternoon, respected panel members. I'm Siddhesh Bangar, and along with my team — Jaden Fernandes, Hemant Chaudhari, and Sebastian Karia — we are presenting our final year project: **MigrateIQ**.

> MigrateIQ is an Intelligent, AI-Powered Desktop Application designed to solve one of the most challenging problems in software engineering today — safely migrating databases between two fundamentally different technologies: MongoDB and PostgreSQL.

> Our project is guided by Professor Dr. Shivsevak Negi, and today we'll walk you through the problem we identified, the research we conducted, the system we have designed, and the implementation we have completed so far.

> Let's begin."

## What This Slide Means
This is just your introduction. You want to come across as confident and well-prepared. Mentioning the guide, team names, and supervisor shows professionalism.

## Panel Q&A for Slide 1

**Q: What is MigrateIQ in one sentence?**
A: "MigrateIQ is a Windows desktop application that uses Gemini AI to intelligently map, validate, and execute database migrations between MongoDB and PostgreSQL, including a built-in dry run mode and automatic rollback generation."

**Q: Why did you choose this topic?**
A: "We identified that database migration is consistently ranked as one of the top causes of application downtime in production. Existing tools either require complete manual SQL scripting, or are too heavily tied to a specific framework. We saw a clear gap — no tool uses AI to bridge the NoSQL-to-relational paradigm shift intelligently — and we designed MigrateIQ to fill it."

**Q: What does the name 'MigrateIQ' mean?**
A: "The name combines 'Migrate' — the core function of the tool — with 'IQ', representing intelligence. The 'IQ' reflects the AI-powered decision-making at the heart of the system: the schema mapping, risk analysis, and natural language DDL generation all done by Gemini AI."

---

---

# SLIDE 2 — Introduction

## What to Say (1.5–2 minutes)

> "So, what exactly is MigrateIQ?

> At its core, MigrateIQ is a **Windows desktop application** that helps software developers safely move their data between two very different kinds of databases — MongoDB and PostgreSQL — in **both directions**. 

> It also has a third workflow — what we call the **Schema Update Assistant** — which helps developers safely modify the structure of an existing live database without causing any downtime.

> The application is built using **Electron and React**, which means it runs completely on your local machine. No data is ever sent to any cloud server. The AI features run through the **Gemini API**, but only schema metadata is sent — never actual user data.

> Now, why does this problem matter?

> This quote from Stripe's engineering blog says it best — *'Migrating a database is one of the riskiest operations a developer can perform. One wrong ALTER TABLE command can lock a production database for hours.'*

> We identified three core workflows that developers face. Workflow A is migrating from MongoDB — which is a flexible, document-based database — to PostgreSQL, which is a strict, relational database. Workflow B is the reverse. And Workflow C helps a developer safely evolve an existing database schema — for example, adding a new column to a table that has a million rows of live production data."

## What This Slide Means
This slide establishes the "what" and "why" of the project. The three workflows tell the panel that this is not just a one-trick tool — it has three real-world use cases.

## Panel Q&A for Slide 2

**Q: What is MongoDB? What is PostgreSQL?**
A: "MongoDB is a NoSQL database that stores data as flexible JSON documents. Each document in a collection can have different fields — there is no enforced structure. PostgreSQL, on the other hand, is a relational database where every row must follow a strict, predefined column structure, and data integrity is enforced through constraints, foreign keys, and transactions."

**Q: Why would someone want to migrate FROM MongoDB TO PostgreSQL?**
A: "There are several common business reasons. First, as a startup grows, the flexible 'schema-less' approach of MongoDB becomes a liability — it's very hard to run complex queries across inconsistently structured data. Second, investors and enterprise clients often require ACID-compliant relational databases for audit trails and compliance. Third, for analytics and reporting, SQL joins are far more powerful than MongoDB's aggregation pipelines for complex queries."

**Q: Why would someone migrate FROM PostgreSQL TO MongoDB?**
A: "This typically happens when a company is scaling horizontally and needs greater flexibility. For example, a product catalogue where different products need completely different attributes — a phone has RAM and storage, while a chair has weight and material. MongoDB's document model handles this naturally without needing to add nullable columns for every possible attribute."

**Q: What is the Schema Update Assistant? Why is it needed?**
A: "The Schema Update Assistant is a tool for safely modifying a live database schema — for example, adding a column, changing a data type, or creating an index. The reason it's dangerous without help is that in PostgreSQL, many ALTER TABLE operations acquire an ACCESS EXCLUSIVE lock, which blocks all reads and writes. Our tool analyzes the operation, classifies the risk level, and either adds safety guardrails automatically — like SET lock_timeout = 5 seconds — or generates the correct zero-downtime pattern — like CREATE INDEX CONCURRENTLY instead of CREATE INDEX."

**Q: Why does it run offline? Why not make it a web app?**
A: "Security. Database connection strings contain passwords and host addresses. Sending that information to a cloud server — even temporarily — creates a significant security risk. By running 100% on the user's local machine using Electron's Node.js backend, the connection credentials never leave the user's computer. Only anonymized schema metadata is sent to the Gemini API for AI analysis."

**Q: What is Electron?**
A: "Electron is an open-source framework created by GitHub that lets you build desktop applications using web technologies — HTML, CSS, and JavaScript. It wraps a Chromium browser for the UI and Node.js for the backend logic. WhatsApp Desktop, Visual Studio Code, and Slack are all built with Electron. We chose it because our team knows React and JavaScript, and it gives us full access to Node.js drivers for both MongoDB and PostgreSQL."

---

---

# SLIDE 3 — Literature Survey

## What to Say (2–2.5 minutes)

> "Our project is grounded in serious academic research. Let me walk you through the five key papers we studied and how they directly influenced our design decisions.

> **First**, Belefqih et al. from 2023 published a comprehensive Systematic Literature Review covering over 50 methods for extracting schemas from NoSQL databases. Their core finding — that sampling-based inference is the most practical approach — directly influenced how our Schema Introspection Engine works. We sample documents from MongoDB collections to detect field names, types, and how often each field is present.

> **Second**, Fernandez et al. from VLDB 2023 — one of the top database research conferences — showed that Large Language Models like GPT and Gemini can semantically understand column names and infer relationships, replacing manual schema mapping in ETL pipelines. This validated our decision to use Gemini AI as the core schema mapper.

> **Third**, Li et al.'s DITTO paper from VLDB 2021 established that pre-trained language models, specifically BERT-style transformers, significantly outperform traditional rule-based systems for understanding field-level semantic similarity. This is the academic foundation for why our AI engine can match a field called 'cust_addr_ln1' to a column called 'customer_street_address' — without being explicitly programmed with that rule.

> **Fourth**, Baazizi et al. from VLDB 2019 proposed algorithms to compute a minimal common schema across millions of heterogeneous JSON documents. Their presence ratio concept — which measures how often each field actually appears across all documents — is directly implemented in our schema inference engine to determine whether a PostgreSQL column should be nullable or not.

> **And fifth**, Trummer's VLDB 2022 tutorial established benchmarks for using LLMs to generate DDL — that is, database definition language like CREATE TABLE and ALTER TABLE — from natural language. This is the foundation of our NL2DDL feature, where a developer can type 'add an optional phone column to users with max 15 characters' and the system generates the correct SQL.

> Looking at the Industry Findings — we found that PostgreSQL's DDL lock behavior is a well-documented production risk. And examining existing tools, none of them apply these LLM-based semantic mapping techniques the way MigrateIQ does."

## What This Slide Means
This slide shows that your project has a solid research foundation. Each paper is mapped to a specific feature of your system.

## Panel Q&A for Slide 3

**Q: What is VLDB?**
A: "VLDB stands for Very Large Data Bases — it's one of the top three international conferences for database research, alongside ACM SIGMOD and IEEE ICDE. Publications at VLDB go through rigorous peer review and represent the best current research in database systems."

**Q: What is schema inference? Why is it needed?**
A: "Schema inference is the process of automatically deducing the structure of a dataset that has no formal schema defined. MongoDB allows any document in a collection to have any fields — there's no enforced structure. Before we can migrate this data to PostgreSQL, we need to understand what fields exist, what data types they contain, and which fields are present in all documents versus only some. Our system does this by sampling documents and building a type histogram for each field."

**Q: What is a presence ratio?**
A: "Presence ratio is a metric from Baazizi et al.'s research. It's calculated as: the number of documents where a field exists and is not null, divided by the total number of documents sampled. If a field like 'phone_number' only appears in 40% of documents, the presence ratio is 0.4. This tells our system that the corresponding PostgreSQL column must be nullable — you cannot make it NOT NULL, because 60% of existing documents have no value for it."

**Q: What is NL2DDL?**
A: "NL2DDL stands for Natural Language to Data Definition Language. It's a feature in our Schema Update Assistant where the developer types a plain English instruction — for example, 'add a not-null email column with a unique constraint to the customers table' — and the Gemini AI parses that intent and generates the correct, safe SQL: ALTER TABLE customers ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '' with a proper DEFAULT value to avoid the NOT NULL error, followed by a UNIQUE constraint."

**Q: How does the DITTO paper connect to schema matching? It's about entity matching.**
A: "That's a great observation. DITTO is specifically about entity matching — determining if two records refer to the same real-world entity. However, the underlying technique — using BERT-style language models to understand semantic similarity between text fields — is directly applicable to schema matching. Whether you're comparing 'Apple Inc' and 'Apple Corporation', or comparing a field named 'cust_id' to a column named 'customer_identifier', both problems require understanding that two different textual representations refer to the same concept. The DITTO paper's finding that pre-trained language models outperform rule engines at this task is exactly why we chose AI over a purely deterministic approach."

**Q: What is type polymorphism in MongoDB?**
A: "Type polymorphism is when the same field in the same MongoDB collection contains different data types in different documents. For example, document A might have `price: 100` as a number, document B might have `price: '100.50'` as a string, and document C might have `price: null`. PostgreSQL cannot accept a column that sometimes gets a number and sometimes gets a string. Our system detects this during schema sampling, computes the type frequency distribution, and decides either to auto-coerce compatible types or to route the field to a JSONB escape-hatch column to prevent data loss."

---

---

# SLIDE 4 — Problem Statement & Scope

## What to Say (1.5–2 minutes)

> "Let me now state the core problem we are solving.

> *'There is no existing free, offline, developer-friendly tool that can intelligently handle the full lifecycle of cross-paradigm database migration, including automated schema mapping, risk detection, dry run simulation, rollback generation, and live schema evolution — all within a single unified interface.'*

> This problem breaks down into five specific technical challenges.

> **Problem 1 — Schema Mismatch.** MongoDB is schema-less. Any document can have any fields. PostgreSQL is completely rigid. Every row must match the exact same column structure. Bridging this gap automatically is extremely complex.

> **Problem 2 — Data Type Incompatibility.** MongoDB uses a format called BSON with 16 unique data types — including ObjectId, Decimal128, and embedded arrays — that have no direct equivalent in SQL. Manual mapping of these types is tedious and error-prone.

> **Problem 3 — Unsafe DDL Operations.** When a developer writes ALTER TABLE on a live production database, PostgreSQL acquires what's called an ACCESS EXCLUSIVE lock. This blocks all reads and writes to that table until the operation completes. If the table has millions of rows, this can take minutes — freezing the entire application.

> **Problem 4 — No Safe Undo.** Most existing tools run your SQL script and that's it. If the migration fails halfway through — 50% of data migrated, 50% not — the database is in a corrupted half-migrated state. There is no way to undo this without a backup.

> **Problem 5 — No Intelligence.** Tools like Flyway require you to write all SQL manually. AWS DMS moves data but doesn't understand relationships — it often dumps nested MongoDB arrays as raw JSON strings into a single column.

> Our scope: we solve all five of these. We are explicitly out of scope for MySQL/SQLite support, real-time change data capture, and user authentication — these are planned future enhancements."

## What This Slide Means
This is the most important slide conceptually. If the panel understands why your project is needed and what exact problems it solves, everything else makes sense.

## Panel Q&A for Slide 4

**Q: What is an ACCESS EXCLUSIVE lock in PostgreSQL?**
A: "When PostgreSQL executes certain ALTER TABLE commands — like adding a NOT NULL column, changing a data type, or dropping a column — it needs to ensure no other query is reading or writing that table while the structural change happens. To guarantee this, it acquires an ACCESS EXCLUSIVE lock, which is the most restrictive lock level. It blocks everything: SELECT, INSERT, UPDATE, and DELETE. On a large production table with millions of rows, the lock can be held for minutes — crashing the application for all connected users."

**Q: How do you solve the lock problem?**
A: "We use three techniques. First, we always prepend SET lock_timeout = '5s' to our generated SQL — so if the lock cannot be acquired within 5 seconds because other queries are running, our operation fails fast instead of queuing up and blocking everything behind it. Second, for index creation, we always generate CREATE INDEX CONCURRENTLY instead of CREATE INDEX — this builds the index in the background without taking an exclusive lock. Third, for adding NOT NULL columns, we follow the safe three-step pattern: add the column as nullable first, backfill existing rows with a default value, then add the NOT NULL constraint."

**Q: What is BSON?**
A: "BSON stands for Binary JSON. It's the binary-encoded format MongoDB uses to store documents. BSON extends JSON with additional data types that standard JSON doesn't support, such as ObjectId (a 12-byte identifier used as MongoDB's primary key), Decimal128 (128-bit decimal precision for financial data), Date objects (stored as 64-bit milliseconds since epoch), and Binary data (raw byte buffers). These types need to be mapped to SQL equivalents during migration, which is one of the core challenges we solve."

**Q: What does 'out of scope' mean? Why didn't you build MySQL support?**
A: "Scope limitation is a standard software engineering principle — every project must define clear boundaries. MySQL support would require implementing a completely separate connection driver, a new type mapping matrix, and testing against a third database engine. This would have tripled the implementation time without adding academic value. Our project demonstrates the core innovation — the AI-powered NoSQL-to-SQL migration pipeline — and MySQL support can be added as a straightforward extension in the future by adding new driver adapters."

**Q: What is CDC — Change Data Capture?**
A: "CDC, or Change Data Capture, is a technique for capturing every insert, update, and delete that happens in a source database and streaming those changes in real-time to a target. Tools like Debezium with Apache Kafka implement this. Our tool does not implement CDC because it is extremely complex infrastructure to set up — it requires a separate Kafka cluster, Zookeeper, and connector configuration. Our tool targets the 'maintenance window' migration use case, which is appropriate for small-to-medium businesses that can afford a brief scheduled downtime for migration."

---

---

# SLIDE 5 — Proposed System

## What to Say (2 minutes)

> "Now let me walk you through what we actually built — MigrateIQ's 8-step guided migration wizard.

> **Step 1** — The user chooses the direction: MongoDB to PostgreSQL, or PostgreSQL to MongoDB.

> **Step 2** — The user enters their source database connection details. As soon as the connection is established, our system automatically introspects the schema — it reads all collection names, samples documents, and builds a complete picture of the source data structure.

> **Step 3** — The user connects the target database. Our system verifies the connection and checks the user has sufficient permissions.

> **Step 4** — This is where the AI kicks in. We send the source schema metadata to Gemini AI, which suggests a complete field-by-field mapping — including which MongoDB field maps to which PostgreSQL column, what data type to use, and which fields should become foreign keys in a child table.

> **Step 5** — The user sees the Visual Schema Mapper — a side-by-side interactive interface showing the source and target schema. The user can review every mapping suggestion, accept or modify them, and add fields that the AI may have missed.

> **Step 6** — The Risk Report screen automatically generates. It classifies every potential issue as Critical, Warning, or Info — with plain English explanations and suggested fixes.

> **Step 7** — Dry Run. The user can simulate the entire migration without touching the real database. The system validates the DDL syntax in a PostgreSQL transaction that is immediately rolled back, and streams a test batch through the transformation engine in memory.

> **Step 8** — Live Migration. The actual ETL engine runs. Data is streamed in 500-row batches from the source, transformed, and inserted into the target. After completion, a 5-stage verification audit confirms data integrity. The rollback script is always available.

> Our four core design principles are: AI-first, Safety by default, Zero Data Loss, and 100% offline."

## What This Slide Means
This slide is your core product description. The wizard diagram makes it visual and easy to follow.

## Panel Q&A for Slide 5

**Q: What does the Visual Schema Mapper look like?**
A: "It's a side-by-side interface. On the left side, you see the source MongoDB collection with all its fields, BSON types, and sample values. On the right side, you see the proposed PostgreSQL table structure. Each row in the mapper represents one field mapping, and for every field, the user can see: the source field name, the suggested target column name (normalized to snake_case), the proposed data type, whether the field is nullable, and whether it's a primary key. Mappings suggested by Gemini AI are labeled with a blue 'AI Suggested' badge. Mappings generated by the rule engine fallback are labeled 'Auto Rule-Mapped'. The user can click any row and change the mapping manually."

**Q: What happens if the AI fails or the API key is missing?**
A: "We have a full deterministic rule engine fallback. If the Gemini API is unavailable — due to no internet connection, rate limiting, or no API key — the system seamlessly falls back to the built-in rule engine. This engine contains a 16-type BSON-to-SQL mapping dictionary: ObjectId becomes VARCHAR(24), String becomes TEXT, Double becomes DECIMAL, Date becomes TIMESTAMPTZ, embedded arrays of objects become child tables, and so on. The schema mapper still works — the mappings just show an 'Auto Rule-Mapped' badge instead of 'AI Suggested'. There is no failure mode."

**Q: What is the Schema Health Score?**
A: "The Schema Health Score is a composite score from 0 to 100 generated by the Gemini AI after analyzing the source schema. It evaluates factors like: how many fields have consistent data types, how many fields are sparse (low presence ratio), whether there are deeply nested structures that are complex to migrate, and whether there are type polymorphism issues. A score of 80-100 means the migration is expected to be clean and straightforward. A score below 50 means there are significant structural issues that need attention before proceeding."

**Q: What is a Rollback Script?**
A: "Before executing any forward migration step, our system pre-generates the exact reverse SQL operation. For example, if the forward step is CREATE TABLE users (...), the rollback is DROP TABLE IF EXISTS users CASCADE. If the forward step is ALTER TABLE users ADD COLUMN phone VARCHAR(15), the rollback is ALTER TABLE users DROP COLUMN IF EXISTS phone. These are bundled into a single rollback.sql file that the user can download. If something goes wrong after migration, the user just runs this one file to undo everything."

**Q: Explain the 5-stage post-migration audit.**
A: "Stage 1 is Row Count Matching — we compare the document count from MongoDB before migration against the row count in PostgreSQL after. Stage 2 is Aggregate Reconciliation — for numeric columns like total_amount, we sum the values in both databases and compare. This catches data type precision issues. Stage 3 is MD5 Checksum Verification — we compute application-layer checksums on a 5% sample of rows using MD5 hashing of concatenated critical field values, and verify the source and target hashes match. Stage 4 is Foreign Key Orphan Check — we verify that no order references a user ID that doesn't exist in the users table. Stage 5 is Performance Benchmark — we run a sample SELECT query on the migrated data and measure response time to confirm indexes were created correctly."

---

---

# SLIDE 6 — Design Details, Methodology & Algorithm

## What to Say (2.5–3 minutes)

> "Let me now go deeper into the architecture and the specific algorithms that power MigrateIQ.

> Looking at the architecture, data flows from the MongoDB source through our Schema Introspection Engine, which samples documents and builds a unified schema representation. This representation is then passed simultaneously to two engines: the Gemini AI Engine and the Rule Engine fallback. The outputs are merged into the Visual Schema Mapper for the user to review. After confirmation, the Risk Analysis Engine and Dry Run Simulator validate the plan, and then the ETL Streaming Engine executes the actual migration into PostgreSQL.

> Now let me explain our four core algorithms.

> **Algorithm 1: Kahn's Topological Sort for Table Insertion Order.** In a relational database, you cannot insert data into a child table before the parent table exists. For example, you cannot insert Orders if the Users table doesn't exist yet, because Orders has a foreign key pointing to Users. We represent all tables and their foreign key dependencies as a Directed Acyclic Graph — a graph where edges show which table depends on which. We then run Kahn's algorithm to compute the correct insertion order. The time complexity is O of V plus E, where V is the number of tables and E is the number of foreign key relationships.

> **Algorithm 2: 3-Tier Type Coercion Pipeline.** Not all MongoDB data is clean. A developer may have stored a price as a string '29.99' in some documents and as a number 29.99 in others. In Tier 1, we pre-scan 100 documents and compute a type frequency distribution for every field. In Tier 2, during actual ETL, we auto-coerce compatible mismatches — for example, string '29.99' is safely converted to decimal 29.99. In Tier 3, completely incompatible values that cannot be coerced are quarantined into a quarantine.json file — the migration continues for all other rows, and the quarantined records are logged for the developer to review.

> **Algorithm 3: Streaming ETL with Backpressure.** A naive implementation would load all 50,000 MongoDB documents into memory at once — and crash. Instead, we use Node.js cursor streaming with a batch size of 500 documents. The MongoDB cursor streams documents one batch at a time. Node.js Streams automatically apply backpressure — if the PostgreSQL write queue is full, the read stream pauses until it catches up. This keeps our memory usage at a constant approximately 80 megabytes regardless of whether the dataset is 1,000 or 10 million records.

> **Algorithm 4: Dual-Layer AI plus Rule Engine.** The Gemini 1.5 Flash API is called with the source schema metadata. Crucially, we use Gemini's response_schema parameter to mathematically constrain the AI output to a valid JSON structure — preventing hallucinations or invalid SQL types. If AI is available, mappings get an 'AI Suggested' badge. If not, the deterministic rule dictionary produces equivalent mappings with an 'Auto Rule-Mapped' badge.

> Our methodology follows the classic ETL pattern: Extract from MongoDB, Transform through the AI mapper and type coercion, and Load into PostgreSQL in topologically-correct order using 500-row bulk inserts with connection pooling."

## What This Slide Means
This is the most technically deep slide. It shows the panel you understand the algorithms and architecture, not just the UI.

## Panel Q&A for Slide 6

**Q: Explain Kahn's algorithm in detail.**
A: "Kahn's algorithm works as follows. First, we build a directed graph where each table is a node, and each foreign key relationship is a directed edge from child to parent — meaning 'this table depends on that table.' Second, we compute the in-degree of every node — the number of tables that the current table depends on. Third, we initialize a queue with all tables that have in-degree zero — these have no dependencies and can be inserted first. Fourth, we repeatedly remove a table from the queue, add it to our ordered output, and reduce the in-degree of all tables that depend on it. If any of those reach in-degree zero, they're added to the queue. We repeat until all tables are ordered. If some tables remain unprocessed, it means there's a circular dependency — this is one of our limitations, listed as 'No Circular FK Detection.'"

**Q: What does 'backpressure' mean in Node.js Streams?**
A: "In a data pipeline, backpressure is the mechanism that prevents a fast data producer from overwhelming a slow data consumer. In our case, MongoDB can produce data faster than PostgreSQL can accept it. Without backpressure, we'd buffer all that data in memory and crash. Node.js Streams solve this with a highWaterMark buffer. When the write stream's internal buffer is full, it signals the read stream to pause. The read stream stops pulling from MongoDB. When the write stream catches up and drains its buffer, it signals the read stream to resume. This happens automatically, keeps memory constant, and is why we can migrate datasets of any size without running out of RAM."

**Q: What is response_schema in the Gemini API?**
A: "response_schema is a parameter in the Gemini API that forces the model to produce output conforming to a JSON schema you define. Without it, an AI model might respond with markdown text, missing fields, or invalid SQL type names like 'STRING' instead of 'VARCHAR'. With response_schema, the API guarantees the output is parseable JSON matching your exact type definitions. We use this to ensure the AI always returns a structured mapping with valid PostgreSQL type names, nullability flags, and properly formatted risk items — so the output can be directly parsed and used without additional validation."

**Q: What is connection pooling?**
A: "Connection pooling is a technique where instead of opening and closing a new database connection for every SQL query, you maintain a pool of pre-established connections that can be reused. Opening a PostgreSQL connection involves a TCP handshake, authentication, and session setup — which takes 20-100 milliseconds. For a migration inserting 500,000 rows, creating a new connection for each batch would add enormous overhead. Our pg library's pool maintains a set of open connections and assigns them to batch insert operations as needed, dramatically improving throughput."

**Q: What is the difference between Gemini 1.5 Flash and Pro? Why did you choose Flash?**
A: "Gemini 1.5 Flash is optimized for speed and cost-efficiency — it's designed for high-volume tasks where you need fast structured outputs. Gemini 1.5 Pro has a larger context window and better complex reasoning, but it's slower and more expensive. For our schema mapping task — which involves processing structured JSON metadata and producing structured JSON output — Flash is the ideal choice. It's also on Google's free tier at 60 requests per minute, making it accessible for student projects."

**Q: What is a DAG — Directed Acyclic Graph?**
A: "A DAG is a graph where edges have direction (A depends on B is different from B depends on A), and it has no cycles (you can never follow edges and return to your starting point). In our system, tables are nodes and 'table A has a foreign key to table B' is a directed edge from A to B. The acyclic property is important — it guarantees a topological sort is possible. If the schema had circular references (Table A FK → Table B FK → Table A), it would be a cycle, and topological sort would be impossible without removing one of the constraints first."

---

---

# SLIDE 7 — Experimental Setup

## What to Say (1.5 minutes)

> "For testing, we created a synthetic e-commerce dataset that deliberately covers every major migration challenge.

> The dataset contains five collections — customer profiles, product catalogue, transaction records, line items, and categories — totalling approximately 20,000 documents. Each collection was designed to test a specific challenge: the customer profiles have mixed naming conventions and nullable fields, the product catalogue has polymorphic specs — different fields for different product categories, the transaction records have embedded arrays of line items representing a one-to-many relationship, and so on.

> The technology stack is clearly divided. The desktop shell uses Electron 28, which gives us access to Node.js for database drivers. The UI is built with React 18 and TypeScript in strict mode — meaning we have zero use of the 'any' type anywhere in the codebase. State management is handled by Zustand for the wizard flow and electron-store for persisting state across app restarts. The AI engine is Google Gemini 1.5 Flash. The database drivers are the official mongodb npm package for MongoDB and pg — node-postgres — for PostgreSQL.

> Our implementation plan spans 16 weeks, divided into 6 phases. We have currently completed Phases 0 through 5, which include the monorepo setup, landing website, desktop app shell, home dashboard, full database connectivity, and the AI schema mapper with the visual Schema Mapper interface."

## What This Slide Means
This slide proves the implementation is real. The specific dataset numbers and tech stack choices show you put thought into testing.

## Panel Q&A for Slide 7

**Q: Why did you use a synthetic dataset rather than real data?**
A: "Two reasons. First, privacy — real customer data cannot be used for academic demonstration without GDPR compliance. Second, control — by designing the synthetic dataset ourselves, we could deliberately introduce specific challenges: type polymorphism in product specs, embedded arrays in orders, nullable fields in customer profiles. This gives us comprehensive test coverage of every edge case our tool must handle, rather than hoping a real dataset happens to contain all these patterns."

**Q: Why TypeScript strict mode?**
A: "TypeScript strict mode enforces several rules that prevent common runtime bugs. The most important is disabling the 'any' type — which means every variable, function parameter, and return value must have an explicit, verified type. In a database migration tool, this is critical: if our IPC channel receives a response from the backend and we treat it as 'any', we might access undefined fields and crash without any helpful error message. With strict types, the TypeScript compiler catches these mismatches at build time, before the app even runs."

**Q: Why Zustand over Redux for state management?**
A: "Redux is powerful but verbose — even simple state updates require defining action types, action creators, and reducers. For a linear 8-step wizard, this overhead is unnecessary. Zustand provides a much simpler API: you define a store with a state object and setter functions, and components subscribe to exactly the state they need. The bundle size is also much smaller — under 1KB for Zustand versus around 10KB for Redux. For this specific use case, Zustand is the right tool."

**Q: What is electron-store and why do you need it?**
A: "electron-store is a simple key-value persistent storage library for Electron apps. When a user fills in their database connection details in Step 2 and then closes the app, that information is lost from memory. electron-store persists it to a JSON file on disk, so when the user reopens the app, their previous session state is restored. It uses the OS's appropriate app data directory — AppData on Windows — to store the file, which is the correct place for application configuration and state."

**Q: What is npm Workspaces?**
A: "npm Workspaces is a monorepo tool built into npm. It allows multiple packages to exist in a single repository and share dependencies. Our project has three packages: desktop (Electron + React), web (Next.js landing site), and shared (TypeScript type definitions). The shared types package is imported by both desktop and web, so any change to a type definition is immediately reflected in both without publishing or reinstalling. This prevents the classic problem where the frontend and backend have different definitions of the same data structure."

---

---

# SLIDE 8 — Limitations & Assumptions

## What to Say (1.5 minutes)

> "Every honest engineering project must acknowledge its limitations, and ours are well-defined.

> Our nine limitations are: We don't support real-time CDC migration — we do batch ETL in a maintenance window. We sample 100 documents for schema inference — highly unusual schemas may have fields we miss, though the user can add them manually. We only support MongoDB and PostgreSQL — MySQL and SQLite are future scope. We require a Gemini API key for AI features — without one, we fall back to the rule engine. There's no mid-migration checkpoint resume. It's single-user only. We target the PostgreSQL default public schema only. Schema inference is probabilistic and can miss rare fields. And finally, circular foreign key references will cause the topological sort to fail.

> Our eight assumptions are equally important. We assume the source database is reachable via TCP. We assume the user has appropriate read and write permissions. We assume the target PostgreSQL database starts empty. We assume MongoDB version 4.4 or later. We assume PostgreSQL version 11 or later — because that's when fast constant-default ADD COLUMN was introduced. We assume the developer will update their application code after migration — and we help with this through the Layer 2 Migration Guide. We assume a minimum 10Mbps network connection for large datasets. And we assume MongoDB documents are under the 16MB BSON limit.

> These limitations don't make the tool less valuable — they define a clear, achievable scope and set honest expectations."

## What This Slide Means
Showing limitations proves academic maturity. Panels respect students who understand what their tool does NOT do.

## Panel Q&A for Slide 8

**Q: Why 100 documents for sampling? Couldn't a larger sample give better accuracy?**
A: "Yes — a larger sample always gives better accuracy, but at a cost. Sampling 100 documents gives us schema inference in under a second even over a network connection. Sampling 10,000 documents could take 30-60 seconds, which would make the UI feel unresponsive. The trade-off is well-established in the research literature — Baazizi et al. showed that for typical databases, 100-500 document samples capture over 95% of field coverage. For the rare edge case where unusual fields exist in less than 1% of documents, the user can manually add them in the Schema Mapper."

**Q: Why PostgreSQL version 11 specifically?**
A: "In PostgreSQL 11, the behavior of ADD COLUMN with a constant DEFAULT value was changed. Before version 11, adding a column with DEFAULT required a full table rewrite — PostgreSQL would scan every row and update it with the new value, which could take hours on large tables. From version 11 onwards, a constant DEFAULT is stored as metadata only — the column appears to have the value for all existing rows, but no physical row update happens. This is the fast-path that makes it safe to add nullable columns to live production tables."

**Q: What happens if someone tries to migrate a 16MB MongoDB document?**
A: "MongoDB's BSON format has a hard 16MB per document limit. If a document hits that limit, it typically means it contains extremely large embedded arrays or binary data. Our type coercion pipeline would identify the document as problematic during the Dry Run phase. In practice, such documents would be quarantined — separated from the main migration into a quarantine.json report. The migration would continue with all other documents. The developer would then manually review the quarantined records and decide how to handle them."

**Q: What do you mean by 'Layer 2 Migration Guide'?**
A: "After migrating data from MongoDB to PostgreSQL, the developer still needs to update their application code. If their Node.js app was using Mongoose queries against MongoDB collections, those queries must be rewritten to use SQL with the new relational schema. The Layer 2 Guide is a document our system auto-generates after migration that shows: the exact table-column mapping, example SQL queries that replace common MongoDB queries, and notes on any relationships that were normalized. It bridges the gap between successfully migrated data and a fully functioning application."

---

---

# SLIDE 9 — Proposed Budget

## What to Say (30–45 seconds)

> "One of the significant advantages of this project is its zero direct cost. Every tool we used is open source with a permissive license or on a completely free tier.

> The database engines — MongoDB Community Edition and PostgreSQL 16 — are free. The desktop framework Electron, the UI framework React with TypeScript, the build tool Vite, and all npm packages — all open source. The AI engine, Google Gemini 1.5 Flash, provides 60 API requests per minute on the free tier, which is more than sufficient for development and demonstration.

> For production commercial deployment, the Gemini API beyond the free tier costs approximately $0.075 per million input tokens — very affordable at scale. Cloud hosting for the landing website could add approximately ₹500 to ₹2,000 per month.

> But for the full scope of this academic project, the total direct cost is zero rupees."

## Panel Q&A for Slide 9

**Q: Is it realistic to say ₹0? Something must cost money.**
A: "The ₹0 figure refers strictly to software licensing costs. The tools we used are all genuinely free — Electron, React, PostgreSQL, and MongoDB Community Edition are all open-source with no licensing fees. Google Gemini 1.5 Flash has a free tier sufficient for our academic project scope. The indirect costs — like internet, electricity, and hardware — are pre-existing personal infrastructure and are not project-specific expenditures. This is a completely standard practice for academic software projects."

**Q: Is the Gemini API really free? What are the limits?**
A: "Yes, Gemini 1.5 Flash has a generous free tier: 60 API requests per minute, 1 million tokens per minute, and 1,500 requests per day. For a migration tool that makes 1-2 API calls per migration session, these limits are effectively unlimited for development and demonstration purposes. The paid tier starts at $0.075 per million input tokens, which is extremely affordable even for production use."

**Q: Why not use a free alternative to Gemini — like Ollama running locally?**
A: "We considered local LLMs but chose Gemini for three reasons. First, quality — Gemini 1.5 Flash produces significantly better schema mapping and structured JSON output than smaller local models. Second, structured output — Gemini's response_schema feature enforces valid JSON output, which is critical for our system. Third, developer experience — the Google GenAI npm package makes integration straightforward. Running a local LLM would require the end user to install and configure additional software, adding significant complexity to the setup process."

---

---

# SLIDE 10 — References

## What to Say (30 seconds)

> "All five papers cited in our Literature Survey are real peer-reviewed publications — four from VLDB, which is one of the top three database research conferences in the world, and one from Recent Advances in Computer Science and Communications. The industry sources are official documentation and engineering blog posts from PostgreSQL.org, MongoDB.com, and GitHub Engineering.

> These references reflect genuine research we studied and directly applied to our system design. I can speak to any of these papers if the panel wishes to discuss them."

## What This Slide Means
Short and confident. Don't read references aloud — just assert that they're real and you've read them.

## Panel Q&A for Slide 10

**Q: Can you summarize what you personally learned from Baazizi et al. 2019?**
A: "Baazizi et al. proposed a parametric algorithm to compute a minimal common schema across millions of JSON documents. The key concept they introduced that I applied was the 'structural union' — combining the schemas of all sampled documents into one merged schema where every field appears. They also formalized the concept of type unions — for example, if a field is String in 80% of documents and Number in 20%, the merged schema represents it as a String-or-Number union type. In our system, we use this concept to compute the presence ratio and determine whether a PostgreSQL column should be nullable."

**Q: What is the difference between a conference paper and a journal paper?**
A: "A conference paper is submitted to a conference, goes through peer review, and is presented in-person to the research community. Conference papers tend to be more timely and cutting-edge. A journal paper goes through a more rigorous multi-round review process and is published in an academic journal — typically more comprehensive and thoroughly validated. VLDB publishes directly in its Proceedings of the VLDB Endowment journal, which is unusual — VLDB conference papers and journal papers are merged. Baazizi et al. was published in The VLDB Journal, which is the companion journal."

---

---

# GENERAL PANEL QUESTIONS (Can Come at Any Time)

**Q: What is the biggest technical challenge you faced?**
A: "The biggest challenge was the type polymorphism problem — when the same MongoDB field contains different data types across different documents. A naive approach would fail because you can't insert both strings and numbers into the same SQL column. We solved this with a 3-tier coercion pipeline: first detect the type distribution, then auto-coerce compatible mismatches, and finally quarantine truly incompatible values. Getting this to work reliably across all 16 BSON types took significant research and testing."

**Q: What is the difference between SQL and NoSQL?**
A: "SQL databases — like PostgreSQL — are relational. Data is stored in tables with predefined columns. Relationships between tables are enforced through foreign keys. They guarantee ACID properties: Atomicity, Consistency, Isolation, and Durability. NoSQL databases — like MongoDB — trade some of these guarantees for flexibility and horizontal scalability. MongoDB stores data as JSON-like documents with no fixed schema. There are no foreign keys — relationships are either embedded (nested documents) or referenced (storing IDs). SQL is better for complex queries and data integrity. NoSQL is better for flexible schemas and horizontal scaling."

**Q: How does your tool compare to AWS DMS?**
A: "AWS DMS is a cloud service that replicates data between databases in real-time. It's powerful but has significant limitations for our use case. First, it's a cloud service — data passes through AWS servers, which is a security concern. Second, it doesn't understand NoSQL-to-SQL schema transformation intelligently — it often dumps MongoDB nested objects as raw JSON strings into a single TEXT column, leaving the developer to restructure manually. Third, it requires AWS account setup and configuration, adding significant complexity. MigrateIQ runs offline, understands the semantic structure of the schema through AI, normalizes nested objects into proper relational tables, and provides visual confirmation before executing anything."

**Q: How do you handle errors during the actual migration?**
A: "We use chunk-level error isolation. The ETL engine processes data in 500-row batches. If a batch fails — for example, because one document has a string in a field that should be an integer — we don't abort the entire migration. Instead, we fall back to single-row insertion for that specific batch, successfully insert the 499 valid rows, and log the 1 problematic document to an errors.json file with its exact document ID and a human-readable explanation. The migration continues with the next batch. At the end, the developer can review the errors file and handle the exceptions manually."

**Q: What security measures did you implement?**
A: "Several. First, database connection strings — including passwords and hostnames — are stored locally using electron-store, which uses the OS's app data directory. They are never logged to the console or sent to any server. Second, when sending schema metadata to Gemini AI, we strip all actual data values — we only send field names, types, and presence ratios. No user data ever leaves the machine. Third, all IPC communication between the Electron main process and the React renderer uses a strict whitelist of channel names defined in the preload script — the renderer cannot make arbitrary Node.js calls."

**Q: Why did you choose Electron over a web app for this?**
A: "A web app would require the database connection strings to pass through a backend server — creating a security vulnerability. Electron gives us full Node.js access in the main process, which means we can connect directly to MongoDB and PostgreSQL from the user's machine, with no intermediary server. The data never leaves the local network. Additionally, Electron allows us to use the official MongoDB native driver and pg driver, which have better performance and feature support than browser-compatible alternatives."

**Q: What is the most innovative feature of MigrateIQ?**
A: "The most innovative feature is the dual-layer AI plus rule engine architecture with structured JSON enforcement. Previous tools were either fully manual (Flyway, Liquibase) or used basic regex/pattern-matching for schema mapping. We use Gemini AI with response_schema enforcement to produce semantically correct, type-safe mappings — understanding that 'cust_nm' should map to 'customer_name' and be VARCHAR, not just blindly copying the field name. But we also ensure zero failure mode through the deterministic fallback — the tool always produces a working migration plan, even with no internet connection."

**Q: If I connect a wrong database by mistake, what happens?**
A: "The connection test in Step 2 provides immediate feedback. If the host is unreachable, the user sees 'Connection refused' with the host and port. If credentials are wrong, they see an authentication error. If the database name doesn't exist, that's also caught. All errors are displayed in plain English in the connection form. The user cannot proceed to Step 3 until a successful connection is established. Similarly for the target database in Step 3 — we verify the connection and check that the user has CREATE TABLE and INSERT permissions before allowing the wizard to continue."

---

> **Final Preparation Tips:**
> 1. Know slides 3, 4, 5, and 6 the best — panels spend most time on these
> 2. For every paper in the literature survey, know ONE specific thing it found
> 3. Be honest about limitations — saying "yes, that's a known limitation, and here's why" is much better than trying to defend something that isn't there
> 4. If you don't know an answer, say "That's a great question — I don't have the exact figure, but what I can tell you is..."
> 5. The panel respects confidence more than perfection — speak clearly and don't rush
