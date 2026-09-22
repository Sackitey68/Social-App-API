const { api, auth, createUser } = require('./helpers/api');
const Follow = require('../src/models/Follow');

// Helpers
const follow = (token, userId) =>
  api().post(`/api/users/${userId}/follow`).set(auth(token));

const unfollow = (token, userId) =>
  api().delete(`/api/users/${userId}/follow`).set(auth(token));

const getFollowing = (userId, query = '') =>
  api().get(`/api/users/${userId}/following${query}`);

const getFollowers = (userId, query = '') =>
  api().get(`/api/users/${userId}/followers${query}`);

// FOLLOW 
describe('POST /api/users/:id/follow', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const bob = await createUser();
    const res = await api().post(`/api/users/${bob.user.id}/follow`);
    expect(res.status).toBe(401);
  });

  it('rejects self-follow with 400', async () => {
    const alice = await createUser();
    const res = await follow(alice.token, alice.user.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yourself/i);
  });

  it('rejects malformed user id with 400', async () => {
    const alice = await createUser();
    const res = await follow(alice.token, 'not-an-id');
    expect(res.status).toBe(400);
  });

  it('rejects unknown user with 404', async () => {
    const alice = await createUser();
    const res = await follow(alice.token, '000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('follows another user successfully', async () => {
    const alice = await createUser();
    const bob = await createUser();

    const res = await follow(alice.token, bob.user.id);
    expect(res.status).toBe(200);
    expect(res.body.data.follower).toBe(alice.user.id);
    expect(res.body.data.following).toBe(bob.user.id);

    // DB has exactly one record
    const count = await Follow.countDocuments({
      follower: alice.user.id,
      following: bob.user.id,
    });
    expect(count).toBe(1);
  });

  it('rejects duplicate follow with 409', async () => {
    const alice = await createUser();
    const bob = await createUser();

    await follow(alice.token, bob.user.id);
    const res = await follow(alice.token, bob.user.id);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already follow/i);

    // Still exactly one record
    const count = await Follow.countDocuments({
      follower: alice.user.id,
      following: bob.user.id,
    });
    expect(count).toBe(1);
  });
});

// UNFOLLOW 
describe('DELETE /api/users/:id/follow', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const bob = await createUser();
    const res = await api().delete(`/api/users/${bob.user.id}/follow`);
    expect(res.status).toBe(401);
  });

  it('rejects self-unfollow with 400', async () => {
    const alice = await createUser();
    const res = await unfollow(alice.token, alice.user.id);
    expect(res.status).toBe(400);
  });

  it('removes a follow relationship', async () => {
    const alice = await createUser();
    const bob = await createUser();

    await follow(alice.token, bob.user.id);
    const res = await unfollow(alice.token, bob.user.id);
    expect(res.status).toBe(200);

    const count = await Follow.countDocuments({
      follower: alice.user.id,
      following: bob.user.id,
    });
    expect(count).toBe(0);
  });

  it('is idempotent — unfollowing a non-followed user returns 200', async () => {
    const alice = await createUser();
    const bob = await createUser();

    // Never followed
    const res = await unfollow(alice.token, bob.user.id);
    expect(res.status).toBe(200);
  });

  it('refollow after unfollow works', async () => {
    const alice = await createUser();
    const bob = await createUser();

    await follow(alice.token, bob.user.id);
    await unfollow(alice.token, bob.user.id);
    const res = await follow(alice.token, bob.user.id);
    expect(res.status).toBe(200);
  });
});

//  FOLLOWERS 
describe('GET /api/users/:id/followers', () => {
  it('returns 400 for malformed id', async () => {
    const res = await getFollowers('not-an-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown user', async () => {
    const res = await getFollowers('000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('returns the correct list of followers', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();

    // alice and bob both follow carol
    await follow(alice.token, carol.user.id);
    await follow(bob.token, carol.user.id);

    const res = await getFollowers(carol.user.id);
    expect(res.status).toBe(200);

    const usernames = res.body.data.users.map((u) => u.username).sort();
    const expected = [alice.user.username, bob.user.username].sort();
    expect(usernames).toEqual(expected);
  });

  it('does NOT include users carol follows (direction check)', async () => {
    const alice = await createUser();
    const bob = await createUser();

    // alice follows bob — so alice is a follower of bob,
    // but alice's own followers list should be empty
    await follow(alice.token, bob.user.id);

    const bobFollowers = await getFollowers(bob.user.id);
    expect(bobFollowers.body.data.users.length).toBe(1);
    expect(bobFollowers.body.data.users[0].username).toBe(alice.user.username);

    const aliceFollowers = await getFollowers(alice.user.id);
    expect(aliceFollowers.body.data.users.length).toBe(0);
  });

  it('paginates correctly', async () => {
    const target = await createUser();
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();

    await follow(a.token, target.user.id);
    await follow(b.token, target.user.id);
    await follow(c.token, target.user.id);

    const page1 = await getFollowers(target.user.id, '?limit=2&page=1');
    const page2 = await getFollowers(target.user.id, '?limit=2&page=2');

    expect(page1.body.data.users.length).toBe(2);
    expect(page2.body.data.users.length).toBe(1);
    expect(page1.body.data.pagination.total).toBe(3);
    expect(page1.body.data.pagination.pages).toBe(2);
  });

  it('never leaks passwords of followers', async () => {
    const target = await createUser();
    const alice = await createUser();
    await follow(alice.token, target.user.id);

    const res = await getFollowers(target.user.id);
    expect(res.body.data.users[0].password).toBeUndefined();
  });

  it('allows anonymous access', async () => {
    const target = await createUser();
    const res = await getFollowers(target.user.id);
    expect(res.status).toBe(200);
  });
});

//  FOLLOWING 
describe('GET /api/users/:id/following', () => {
  it('returns 400 for malformed id', async () => {
    const res = await getFollowing('not-an-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown user', async () => {
    const res = await getFollowing('000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('returns the correct list of users being followed', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();

    // alice follows bob and carol
    await follow(alice.token, bob.user.id);
    await follow(alice.token, carol.user.id);

    const res = await getFollowing(alice.user.id);
    expect(res.status).toBe(200);

    const usernames = res.body.data.users.map((u) => u.username).sort();
    const expected = [bob.user.username, carol.user.username].sort();
    expect(usernames).toEqual(expected);
  });

  it('is empty for a user who follows nobody', async () => {
    const alice = await createUser();
    const res = await getFollowing(alice.user.id);
    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBe(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it('following and followers are NOT swapped', async () => {
    const alice = await createUser();
    const bob = await createUser();

    await follow(alice.token, bob.user.id);

    const aliceFollowing = await getFollowing(alice.user.id);
    const aliceFollowers = await getFollowers(alice.user.id);
    const bobFollowing = await getFollowing(bob.user.id);
    const bobFollowers = await getFollowers(bob.user.id);

    expect(aliceFollowing.body.data.users.length).toBe(1); // alice → bob
    expect(aliceFollowers.body.data.users.length).toBe(0); // nobody → alice
    expect(bobFollowing.body.data.users.length).toBe(0); // bob → nobody
    expect(bobFollowers.body.data.users.length).toBe(1); // alice → bob

    expect(aliceFollowing.body.data.users[0].username).toBe(bob.user.username);
    expect(bobFollowers.body.data.users[0].username).toBe(alice.user.username);
  });

  it('never leaks passwords', async () => {
    const alice = await createUser();
    const bob = await createUser();
    await follow(alice.token, bob.user.id);

    const res = await getFollowing(alice.user.id);
    expect(res.body.data.users[0].password).toBeUndefined();
  });
});
