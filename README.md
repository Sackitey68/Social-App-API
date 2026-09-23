# Social Blog API

A RESTful API for a social blogging platform — **Node.js**, **Express**, **MongoDB**. JWT auth, draft/published posts, follows, likes, pagination, search, sorting, and full test coverage.

- **Live URL:** https://social-app-api-04nr.onrender.com
- **Health check:**  https://social-app-api-04nr.onrender.com/health

> Render free tier sleeps after 15 min of inactivity. First request may take ~60s.

---

## Features

- JWT auth (signup, signin, 1-hour expiry, bcrypt hashed passwords)
- Posts with draft → published workflow (owner-only mutations)
- Tags, search (title / tags / author), sorting (timestamp, likes, comments)
- Follow / unfollow + followers & following lists
- Idempotent like / unlike with counter that stays in sync
- Pagination on every list endpoint (default 20/page)
- 100+ Jest + Supertest tests covering every endpoint

---

## Setup

```bash
git clone https://github.com/sackitey68/Social-App-API.git
cd Social-App-API
npm install
npm run dev               # or: npm start
```

Server runs at `http://localhost:3000`.

Verify:

```bash
curl http://localhost:3000/health
```

---

## Environment Variables

| Key | Description |
|-----|-------------|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | Server port (default `3000`) |
| `MONGO_URI` | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | Long random string (32+ chars) |
| `JWT_EXPIRES_IN` | Token lifetime (default `1h`) |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Tests

```bash
npm test
```

Tests run against a separate `social_blog_test` database (derived from `MONGO_URI`) so your dev data is untouched.

---

## API Reference

Auth header for protected routes: `Authorization: Bearer <token>`

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | — | Register (returns user + JWT) |
| POST | `/signin` | — | Sign in (returns user + JWT) |

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Tettey","last_name":"Kwame","username":"tettey_kwame","email":"kwame@example.com","password":"secret1234"}'
```

### Posts — `/api/posts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List published posts |
| GET | `/me` | ✅ | List own posts (draft + published) |
| GET | `/:id` | Public | Get a single post (drafts visible to owner only) |
| POST | `/` | ✅ | Create post (always starts as draft) |
| PATCH | `/:id/publish` | Owner | Publish draft |
| PATCH | `/:id` | Owner | Edit title / content / tags |
| DELETE | `/:id` | Owner | Delete post |

**`GET /posts` query params:** `page`, `limit`, `search`, `tag`, `author`, `sort`
(`sort` accepts `timestamp`, `-timestamp`, `like_count`, `-like_count`, `comment_count`, `-comment_count`)

**`GET /posts/me` query params:** `page`, `limit`, `state=draft|published|all`, `sort`

### Likes — `/api/posts/:id/like`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/:id/like` | ✅ | Like a published post (idempotent) |
| DELETE | `/:id/like` | ✅ | Unlike (idempotent) |

### Users & Follows — `/api/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/:id/follow` | ✅ | Follow a user |
| DELETE | `/:id/follow` | ✅ | Unfollow |
| GET | `/:id/followers` | Public | List followers |
| GET | `/:id/following` | Public | List following |

### Health

```bash
curl http://localhost:3000/health
```

---

## Project Structure

```
src/
├── config/        # Mongo connection
├── controllers/   # auth, post, user, like
├── middleware/    # auth, errorHandler, notFound
├── models/        # User, Post, Follow, Like
├── routes/        # Express routers
├── utils/         # token, asyncHandler, query, validate
├── app.js         # Express app (exported for tests)
└── server.js      # DB connect + listen
tests/             # Jest + Supertest suites
docs/              # Postman collection
```

---

## Design Notes

- **`app.js` / `server.js` split** — app is exported so Supertest can drive it without a listener.
- **`asyncHandler` wrapper** — thrown errors reach the central error handler automatically.
- **Whitelisted updates** — `PATCH /posts/:id` accepts only `title`, `content`, `tags`.
- **Draft privacy** — drafts return `404` to non-owners (no enumeration).
- **Compound unique indexes** — `Follow(follower, following)`, `Like(user, post)`.
- **Idempotent like/unlike** — `like_count` always matches `Like` documents.
- **Enumeration protection** — signin uses the same 401 message for wrong email and wrong password.
- **Rate limiter** — 100 req / 15 min per IP in prod; disabled in tests.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run in production |
| `npm run dev` | Run with nodemon |
| `npm test` | Run test suite |

---

## License

MIT — see [LICENSE](./LICENSE).
