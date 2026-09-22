const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { createUser } = require('./helpers/api');
const { protect, optionalAuth } = require('../src/middleware/auth');
const User = require('../src/models/User');


// Build a throwaway Express app that mounts test-only routes using
// our real middleware. This keeps app.js clean of test routes while
// giving us full control over what we're testing.

const express = require('express');
const errorHandler = require('../src/middleware/errorHandler');

const testApp = express();
testApp.use(express.json());
testApp.get('/protected', protect, (req, res) =>
  res.json({ success: true, user: req.user.toJSON() })
);
testApp.get('/optional', optionalAuth, (req, res) =>
  res.json({
    success: true,
    authenticated: Boolean(req.user),
    user: req.user ? req.user.toJSON() : null,
  })
);
testApp.use(errorHandler);

const testApi = () => request(testApp);


// Helpers
const SECRET = process.env.JWT_SECRET;

const validToken = (userId, opts = {}) =>
  jwt.sign({ id: userId }, SECRET, { expiresIn: '1h', ...opts });

const expiredToken = (userId) =>
  jwt.sign({ id: userId }, SECRET, { expiresIn: '-1s' });

const tamperedToken = (userId) => {
  const t = validToken(userId);
  // Flip a character in the signature segment
  const parts = t.split('.');
  parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith('aa') ? 'bb' : 'aa');
  return parts.join('.');
};

//  PROTECT 
describe('middleware: protect', () => {
  it('accepts a valid token and attaches req.user', async () => {
    const { user, token } = await createUser();
    const res = await testApi()
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects missing Authorization header with 401', async () => {
    const res = await testApi().get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Authentication required/i);
  });

  it('rejects non-Bearer schemes with 401', async () => {
    const { token } = await createUser();
    const res = await testApi()
      .get('/protected')
      .set('Authorization', `Basic ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects malformed tokens with 401 "Invalid token"', async () => {
    const res = await testApi()
      .get('/protected')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid token/i);
  });

  it('rejects tampered tokens with 401 "Invalid token"', async () => {
    const { user } = await createUser();
    const res = await testApi()
      .get('/protected')
      .set('Authorization', `Bearer ${tamperedToken(user.id)}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid token/i);
  });

  it('rejects expired tokens with 401 "Token expired"', async () => {
    const { user } = await createUser();
    const res = await testApi()
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken(user.id)}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token expired/i);
  });

  it('rejects valid tokens whose user no longer exists', async () => {
    const { user } = await createUser();
    const token = validToken(user.id);

    // Simulate user deletion after token issuance
    await User.deleteOne({ _id: user.id });

    const res = await testApi()
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no longer exists/i);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const { user } = await createUser();
    const badToken = jwt.sign({ id: user.id }, 'some_other_secret_at_least_32_chars_long', {
      expiresIn: '1h',
    });
    const res = await testApi()
      .get('/protected')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid token/i);
  });
});

//  OPTIONAL AUTH 
describe('middleware: optionalAuth', () => {
  it('allows anonymous access with no header', async () => {
    const res = await testApi().get('/optional');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
    expect(res.body.user).toBeNull();
  });

  it('attaches req.user when a valid token is present', async () => {
    const { user, token } = await createUser();
    const res = await testApi()
      .get('/optional')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.id).toBe(user.id);
  });

  it('rejects malformed tokens with 401 (does not silently ignore)', async () => {
    const res = await testApi()
      .get('/optional')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid token/i);
  });

  it('rejects expired tokens with 401', async () => {
    const { user } = await createUser();
    const res = await testApi()
      .get('/optional')
      .set('Authorization', `Bearer ${expiredToken(user.id)}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token expired/i);
  });

  it('continues as anonymous if token is valid but user is deleted', async () => {
    const { user } = await createUser();
    const token = validToken(user.id);
    await User.deleteOne({ _id: user.id });

    const res = await testApi()
      .get('/optional')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
    expect(res.body.user).toBeNull();
  });
});

//  INTEGRATION ON REAL ROUTES 
describe('middleware integration on real routes', () => {
  it('protects POST /api/posts', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({ title: 'x', content: 'y' });
    expect(res.status).toBe(401);
  });

  it('allows anonymous GET /api/posts via optionalAuth', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
  });

  it('allows anonymous GET /api/users/:id/followers', async () => {
    const { user } = await createUser();
    const res = await request(app).get(`/api/users/${user.id}/followers`);
    expect(res.status).toBe(200);
  });
});
