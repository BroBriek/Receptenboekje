# Receptenboekje

Advanced meal planner and recipe storage system built with **Node.js**, **Express**, and **SQLite**.
This project is just a tool for personal use and is not intended for production use. 

---

## Project Structure

```
.
├── src/
│   ├── server.js               # Express app entry point
│   ├── db/
│   │   ├── database.js         # SQLite singleton (better-sqlite3)
│   │   └── migrate.js          # Migration runner
│   └── middleware/
│       └── upload.js           # Multer image upload middleware
├── data/                       # SQLite database (gitignored, Docker volume)
├── uploads/                    # Uploaded images  (gitignored, Docker volume)
├── Dockerfile                  # Multi-stage production image
├── docker-compose.yml          # Compose with persistent bind-mounts
└── .env.example                # Environment variable template
```

---

## Getting Started (Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Run database migrations
npm run db:migrate

# 4. Start the dev server (with auto-reload)
npm run dev
```

The server will be available at **http://localhost:3000**.

---

## Docker Deployment

The database (`./data/`) and uploaded images (`./uploads/`) are mounted as **bind volumes** so they survive container rebuilds.

```bash
# Build and start
docker compose up -d --build

# Rebuild image without losing data
docker compose up -d --build   # data & uploads are untouched

# View logs
docker compose logs -f

# Stop
docker compose down
```

> Set a secure `SESSION_SECRET` in your environment or a `.env` file before deploying to production.

---

## API

| Method | Path      | Description           |
|--------|-----------|-----------------------|
| GET    | `/health` | Health check endpoint |

_More routes will be added as features are implemented._

---

## Database Schema

| Table                | Purpose                              |
|----------------------|--------------------------------------|
| `recipes`            | Core recipe records                  |
| `ingredients`        | Ingredient catalogue                 |
| `recipe_ingredients` | Quantities per recipe                |
| `recipe_steps`       | Ordered instructions                 |
| `tags`               | Tag catalogue                        |
| `recipe_tags`        | Many-to-many recipe ↔ tag            |
| `meal_plan_entries`  | Calendar-based meal planning         |
| `migrations`         | Applied migration tracking           |
