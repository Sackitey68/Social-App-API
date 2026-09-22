const { api, createUser } = require('./helpers/api');

describe('Test harness', () => {
  it('loads the Express app and hits /health', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('creates a user via the helper', async () => {
    const { user, token } = await createUser();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    expect(token).toBeTruthy();
  });
});