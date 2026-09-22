const { api, createUser } = require('./helpers/api');
const User = require('../src/models/User');
const verifyToken = require('../src/utils/verifyToken');

describe('POST /api/auth/signup', () => {
  const validPayload = () => ({
    first_name: 'Ama',
    last_name: 'Mensah',
    username: `ama_${Math.floor(Math.random() * 1e9)}`,
    email: `ama_${Math.floor(Math.random() * 1e9)}@test.com`,
    password: 'secret123',
  });

  it('creates a user with valid data and returns 201', async () => {
    const res = await api().post('/api/auth/signup').send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.token).toBeTruthy();
  });

  it('returns the created user with expected fields', async () => {
    const payload = validPayload();
    const res = await api().post('/api/auth/signup').send(payload);

    expect(res.body.data.user.username).toBe(payload.username);
    expect(res.body.data.user.email).toBe(payload.email.toLowerCase());
    expect(res.body.data.user.first_name).toBe(payload.first_name);
    expect(res.body.data.user.last_name).toBe(payload.last_name);
    expect(res.body.data.user.full_name).toBe(`${payload.first_name} ${payload.last_name}`);
    expect(res.body.data.user.id).toBeTruthy();
  });

  it('never returns the password field', async () => {
    const res = await api().post('/api/auth/signup').send(validPayload());
    expect(res.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('secret123');
  });

  it('stores the password hashed, not plaintext', async () => {
    const payload = validPayload();
    await api().post('/api/auth/signup').send(payload);

    const stored = await User.findOne({ email: payload.email.toLowerCase() }).select('+password');
    expect(stored.password).toBeDefined();
    expect(stored.password).not.toBe(payload.password);
    expect(stored.password).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });

  it('rejects missing required fields with 400', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ first_name: 'Ama', email: 'only@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required field/);
    // Should list all missing fields
    expect(res.body.message).toMatch(/last_name/);
    expect(res.body.message).toMatch(/username/);
    expect(res.body.message).toMatch(/password/);
  });

  it('rejects invalid email format with 400', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ ...validPayload(), email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/email/);
  });

  it('rejects short password with 400', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ ...validPayload(), password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toMatch(/password/);
  });

  it('rejects duplicate email with 409', async () => {
    const first = validPayload();
    await api().post('/api/auth/signup').send(first);

    const second = { ...validPayload(), email: first.email };
    const res = await api().post('/api/auth/signup').send(second);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/[Ee]mail/);
  });

  it('rejects duplicate username with 409', async () => {
    const first = validPayload();
    await api().post('/api/auth/signup').send(first);

    const second = { ...validPayload(), username: first.username };
    const res = await api().post('/api/auth/signup').send(second);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/[Uu]sername/);
  });

  it('signup token has exactly 1-hour expiry', async () => {
    const res = await api().post('/api/auth/signup').send(validPayload());
    const decoded = verifyToken(res.body.data.token);
    expect(decoded.exp - decoded.iat).toBe(3600);
  });
});

describe('POST /api/auth/signin', () => {
  it('signs in with correct credentials and returns 200', async () => {
    const { user, password } = await createUser();
    const res = await api()
      .post('/api/auth/signin')
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.token).toBeTruthy();
  });

  it('never returns the password field on signin', async () => {
    const { user, password } = await createUser();
    const res = await api()
      .post('/api/auth/signin')
      .send({ email: user.email, password });

    expect(res.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(password);
  });

  it('treats email as case-insensitive', async () => {
    const { user, password } = await createUser();
    const res = await api()
      .post('/api/auth/signin')
      .send({ email: user.email.toUpperCase(), password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('returns 401 with "Invalid credentials" for wrong password', async () => {
    const { user } = await createUser();
    const res = await api()
      .post('/api/auth/signin')
      .send({ email: user.email, password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 with identical message for unknown email (enumeration protection)', async () => {
    const unknown = await api()
      .post('/api/auth/signin')
      .send({ email: 'ghost@nowhere.test', password: 'whatever' });

    const { user } = await createUser();
    const wrongPw = await api()
      .post('/api/auth/signin')
      .send({ email: user.email, password: 'wrongpass' });

    // Critical: same status + same message means attackers can't tell the difference
    expect(unknown.status).toBe(401);
    expect(wrongPw.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPw.body.message);
  });

  it('rejects missing fields with 400', async () => {
    const res = await api().post('/api/auth/signin').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/);
  });

  it('signin token is valid and has 1-hour expiry', async () => {
    const { user, password } = await createUser();
    const res = await api()
      .post('/api/auth/signin')
      .send({ email: user.email, password });

    const decoded = verifyToken(res.body.data.token);
    expect(decoded.id).toBe(user.id);
    expect(decoded.exp - decoded.iat).toBe(3600);
  });
});
