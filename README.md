cat > README.md << 'EOF'
# Social Blog API

A production-ready RESTful API for a social blogging platform — built with **Node.js**, **Express**, and **MongoDB**. Supports JWT authentication, draft/published posts, follow relationships, likes, pagination, filtering, search, and full test coverage.

## Live Demo

- **API Base URL:** _add your deployed URL here after Step 21_
- **Health check:** `GET /health`

## Features

- 🔐 **JWT authentication** — signup, signin, 1-hour token expiry
- 📝 **Posts** — draft → published workflow, owner-only edits and deletes
- 🏷️ **Tags, search, sort** — full-text search across title/tags/author; sort by recency, likes, or comments
- 👥 **Social graph** — follow/unfollow, followers and following lists
- ❤️ **Likes** — idempotent like/unlike with a counter that always matches the Like documents
- 📄 **Pagination** — every list endpoint is paginated, defaults to 20 per page
- 🧪 **Tests** — 100+ Jest + Supertest tests covering every endpoint
- 🛡️ **Security** — Helmet, CORS, rate limiting, bcrypt hashing, user-enumeration protection

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js |
| Framework | Express |
| Database | MongoDB + Mongoose |
| Auth | JSON Web Tokens (jsonwebtoken) |
| Hashing | bcryptjs |
| Testing | Jest + Supertest |
| Security | Helmet, CORS, express-rate-limit |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/Sackitey68/Social-App-API
cd social-App-Api
npm install
```