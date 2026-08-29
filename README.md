# Receptenboekje

Advanced meal planner and recipe storage system built with **Node.js**, **Express**, and **SQLite**.
This project is just a tool for personal use and is not intended for professional/commercial use. 

---

## Project Structure

```
.
├── src/
│   ├── server.js               # Express app entry point
│   ├── db/
│   │   ├── database.js         # SQLite singleton (better-sqlite3)
│   │   ├── migrate.js          # Migration runner
│   │   └── seed_recipes.js     # Default recipe seeder
│   ├── middleware/
│   │   ├── auth.js             # Authentication & session middleware
│   │   └── upload.js           # Multer image upload middleware
│   ├── routes/
│   │   ├── auth.js             # User login, registration & session routes
│   │   ├── ingredients.js      # Ingredient catalogue & autocompletion routes
│   │   ├── mealPlan.js         # Shared meal planner & menu generator routes
│   │   ├── recipes.js          # Recipe CRUD & filtering routes
│   │   └── tags.js             # Tag management routes
│   └── public/                 # Frontend SPA assets
│       ├── index.html          # SPA entry point HTML
│       ├── index.css           # Global stylesheet entry point
│       ├── index.js            # Frontend router & view bootstrapper
│       ├── css/                # Modular CSS stylesheets (views, modals, components)
│       └── js/
│           ├── api.js          # Client-side API request helpers
│           ├── app.js          # App state & toast notifications
│           ├── init.js         # Initialization lifecycle
│           ├── router.js       # Client-side router
│           ├── utils.js        # Formatting & utility helpers
│           ├── modals/         # Modal dialog handlers (shopping list, week menu, etc.)
│           └── views/          # Page view controllers (recipes, planner, settings, etc.)
├── scripts/
│   └── download-stock.js       # Script to download stock recipe imagery
├── data/                       # SQLite database (gitignored, Docker volume)
├── uploads/                    # Uploaded recipe images & stock library (gitignored, Docker volume)
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

The server will be available at **http://localhost:3001**.

### Default Admin Account

Upon running database migrations on a new installation, a default administrator account is initialized:

- **Username:** `admin`
- **Password:** `admin`

> **Note:** It is strongly recommended to change the admin password or create a personal account after initial setup.

---

## Docker Deployment

The database (`./data/`) and uploaded images (`./uploads/`) are mounted as **bind volumes** so they survive container rebuilds.

```bash
# Build and start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Automatic Startup on Server Boot
The container is configured with `restart: unless-stopped`. Ensure Docker itself is set to run on system boot:
```bash
sudo systemctl enable docker
```
Once started with `docker compose up -d`, the container will automatically start whenever the server reboots.

### Updating the Application

- **Soft Update** (pulls repository and rebuilds using Docker cache):
  ```bash
  ./softupdate.sh
  ```
- **Full Update** (pulls repository and rebuilds from scratch using `--no-cache`):
  ```bash
  ./update.sh
  ```

> Set a secure `SESSION_SECRET` in your environment or a `.env` file before deploying to production.

---

## API

| Method / Prefix   | Path              | Description                                   |
|-------------------|-------------------|-----------------------------------------------|
| GET               | `/health`         | Health check endpoint                         |
| `/api/auth`       | `/*`              | User authentication & profile endpoints       |
| `/api/recipes`    | `/*`              | Recipe CRUD, image uploads & filtering        |
| `/api/tags`       | `/*`              | Tag management & categorisation               |
| `/api/ingredients`| `/*`              | Ingredient catalogue & autocompletion         |
| `/api/meal-plan`  | `/*`              | Shared meal planner & auto-menu generator     |

---

## Database Schema

| Table                | Purpose                              |
|----------------------|--------------------------------------|
| `users`              | User accounts & authentication       |
| `recipes`            | Core recipe records                  |
| `ingredients`        | Ingredient catalogue                 |
| `recipe_ingredients` | Quantities per recipe                |
| `recipe_steps`       | Ordered instructions                 |
| `tags`               | Tag catalogue                        |
| `recipe_tags`        | Many-to-many recipe ↔ tag            |
| `meal_plan_entries`  | Calendar-based meal planning         |
| `migrations`         | Applied migration tracking           |
