// tests/setup.js
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_at_least_32_characters_long_ok';
process.env.JWT_EXPIRES_IN = '1h';

const mongoose = require('mongoose');

const buildTestUri = () => {
  const base = process.env.MONGO_URI;
  if (!base) return 'mongodb://127.0.0.1:27017/social_blog_test';
  return base.replace(/\/[^/?]*(\?|$)/, '/social_blog_test$1');
};

const TEST_MONGO_URI = buildTestUri();
console.log('🧪 Test DB:', TEST_MONGO_URI.replace(/:[^:@]+@/, ':****@'));

beforeAll(async () => {
  await mongoose.connect(TEST_MONGO_URI);
}, 60000);

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
}, 60000);