# Internal Product Management Tool — Backend (Node.js + SQLite)

Production-ready backend for managing **Categories**, **Attributes**, and **Products** with dynamic category-specific custom attributes.

## Stack
- Node.js (Express)
- SQLite (better-sqlite3)
- Zod validation
- Swagger UI docs at `/docs`

## Quick Start
```bash
npm install
cp .env.example .env
npm start
# (optional) seed demo data
npm run seed
```

Server starts on `http://localhost:${PORT:-8080}`.

### OpenAPI Docs
Visit `http://localhost:8080/docs`

## Folder Structure
```
.
├── migrations/          # SQL migrations
├── scripts/             # Seed script
├── src/
│   ├── app.js
│   ├── server.js
│   ├── db.js
│   ├── migrate.js
│   ├── utils/
│   │   ├── validators.js
│   │   └── errors.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── categories.js
│   │   ├── attributes.js
│   │   └── products.js
│   └── services/
│       ├── categories.js
│       ├── attributes.js
│       └── products.js
├── swagger.json
├── package.json
└── .env.example
```

## Key Features
- Dynamic categories with custom attributes (EAV model)
- Strong validation for attribute types: `TEXT`, `NUMBER`, `BOOLEAN`, `ENUM`, `DATE`, `DATETIME`
- Required & unique attribute constraints (per-category)
- Soft delete for categories/products (`is_active`, `status`)
- Idempotent migrations, foreign keys ON, timestamps
- Fully documented REST API

## Sample cURL
```bash
# Create category
curl -X POST http://localhost:8080/api/categories -H "Content-Type: application/json" -d '{"name":"Watches","description":"Watches cat."}'

# Create attribute
curl -X POST http://localhost:8080/api/attributes -H "Content-Type: application/json" -d '{"name":"Dial Color","data_type":"TEXT"}'

# Map attribute to category (required)
curl -X POST http://localhost:8080/api/categories/1/attributes -H "Content-Type: application/json" -d '{"attribute_id":1,"is_required":true,"is_unique":false,"position":1}'

# Create product with attributes by name
curl -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -d '{
  "category_id": 1,
  "sku": "WAT-001",
  "name": "Classic Watch",
  "price": 1999,
  "currency": "INR",
  "attributes": {"Dial Color":"Black"}
}'
```

## Notes
- SQLite file path is configurable via `DATABASE_FILE`.
- To reset locally, delete the `data/` folder and restart.
## Notes
- Class Diagrams are given in file ClassDiagram.png
- ER Diagram is given in file ErDiagram.png
