const request = require('supertest');
const app = require('../../src/app');

const api = () => request(app);

// Convenience: perform authenticated request
const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Convenience: sign up a user and return { user, token }
const createUser = async (overrides = {}) => {
  const rand = Math.floor(Math.random() * 1e9);
  const payload = {
    first_name: 'Test',
    last_name: 'User',
    username: `user_${rand}`,
    email: `user_${rand}@test.com`,
    password: 'secret123',
    ...overrides,
  };

  const res = await api().post('/api/auth/signup').send(payload);
  if (res.status !== 201) {
    throw new Error(`Failed to create user: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { user: res.body.data.user, token: res.body.data.token, password: payload.password };
};

module.exports = { api, auth, createUser };