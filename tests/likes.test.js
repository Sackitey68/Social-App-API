const { api, auth, createUser } = require('./helpers/api');
const Post = require('../src/models/Post');
const Like = require('../src/models/Like');

// helpers 
const createPost = (token, overrides = {}) =>
  api()
    .post('/api/posts')
    .set(auth(token))
    .send({
      title: 'Likeable Post',
      content: 'Body',
      ...overrides,
    });

const publish = (token, id) =>
  api().patch(`/api/posts/${id}/publish`).set(auth(token));

const likePost = (token, id) =>
  api().post(`/api/posts/${id}/like`).set(auth(token));

const unlikePost = (token, id) =>
  api().delete(`/api/posts/${id}/like`).set(auth(token));

// Create a published post and return it
const createPublishedPost = async (token) => {
  const post = (await createPost(token)).body.data.post;
  await publish(token, post.id);
  return post;
};

// ============ LIKE ============
describe('POST /api/posts/:id/like', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const owner = await createUser();
    const post = await createPublishedPost(owner.token);

    const res = await api().post(`/api/posts/${post.id}/like`);
    expect(res.status).toBe(401);
  });

  it('rejects malformed post id with 400', async () => {
    const { token } = await createUser();
    const res = await likePost(token, 'not-an-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent post', async () => {
    const { token } = await createUser();
    const res = await likePost(token, '000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a draft post (drafts cannot be liked)', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const draft = (await createPost(owner.token)).body.data.post;

    const res = await likePost(liker.token, draft.id);
    expect(res.status).toBe(404);
  });

  it('likes a published post and increments like_count', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    const res = await likePost(liker.token, post.id);
    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(true);
    expect(res.body.data.like_count).toBe(1);

    // Confirm DB state
    const dbPost = await Post.findById(post.id);
    const dbLikes = await Like.countDocuments({ post: post.id });
    expect(dbPost.like_count).toBe(1);
    expect(dbLikes).toBe(1);
  });

  it('is idempotent — liking twice keeps count at 1', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    await likePost(liker.token, post.id);
    const res = await likePost(liker.token, post.id);

    expect(res.status).toBe(200);
    expect(res.body.data.like_count).toBe(1);

    const dbLikes = await Like.countDocuments({ post: post.id });
    expect(dbLikes).toBe(1);
  });

  it('two different users → like_count 2', async () => {
    const owner = await createUser();
    const u1 = await createUser();
    const u2 = await createUser();
    const post = await createPublishedPost(owner.token);

    await likePost(u1.token, post.id);
    const res = await likePost(u2.token, post.id);

    expect(res.status).toBe(200);
    expect(res.body.data.like_count).toBe(2);

    const dbLikes = await Like.countDocuments({ post: post.id });
    expect(dbLikes).toBe(2);
  });

  it('a user can like multiple posts', async () => {
    const owner = await createUser();
    const liker = await createUser();

    const a = await createPublishedPost(owner.token);
    const b = await createPublishedPost(owner.token);

    await likePost(liker.token, a.id);
    await likePost(liker.token, b.id);

    const dbLikes = await Like.countDocuments({ user: liker.user.id });
    expect(dbLikes).toBe(2);
  });
});

// ============ UNLIKE ============
describe('DELETE /api/posts/:id/like', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const owner = await createUser();
    const post = await createPublishedPost(owner.token);

    const res = await api().delete(`/api/posts/${post.id}/like`);
    expect(res.status).toBe(401);
  });

  it('is idempotent — unliking a post never liked returns 200', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    const res = await unlikePost(liker.token, post.id);
    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(false);
    expect(res.body.data.like_count).toBe(0);
  });

  it('removes a like and decrements count', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    await likePost(liker.token, post.id);

    const res = await unlikePost(liker.token, post.id);
    expect(res.status).toBe(200);
    expect(res.body.data.like_count).toBe(0);

    const dbLikes = await Like.countDocuments({ post: post.id });
    expect(dbLikes).toBe(0);
  });

  it('never lets like_count go negative', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    // Never liked, but unlike twice
    await unlikePost(liker.token, post.id);
    const res = await unlikePost(liker.token, post.id);

    expect(res.status).toBe(200);
    expect(res.body.data.like_count).toBe(0);
  });

  it('unliking after like then unlike then like works', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    await likePost(liker.token, post.id);      // 1
    await unlikePost(liker.token, post.id);    // 0
    const res = await likePost(liker.token, post.id); // 1 again
    expect(res.body.data.like_count).toBe(1);
  });

  it('removes only the caller\'s own like', async () => {
    const owner = await createUser();
    const u1 = await createUser();
    const u2 = await createUser();
    const post = await createPublishedPost(owner.token);

    await likePost(u1.token, post.id);
    await likePost(u2.token, post.id);

    // u1 unlikes; u2's like should remain
    const res = await unlikePost(u1.token, post.id);
    expect(res.body.data.like_count).toBe(1);

    const remaining = await Like.find({ post: post.id });
    expect(remaining.length).toBe(1);
    expect(String(remaining[0].user)).toBe(u2.user.id);
  });
});

// INTEGRATION 
describe('Like integration with feed', () => {
  it('list and single-post endpoints reflect like_count', async () => {
    const owner = await createUser();
    const liker = await createUser();
    const post = await createPublishedPost(owner.token);

    await likePost(liker.token, post.id);

    // Single post
    const single = await api().get(`/api/posts/${post.id}`);
    expect(single.body.data.post.like_count).toBe(1);

    // List feed
    const list = await api().get('/api/posts');
    const found = list.body.data.posts.find((p) => p.id === post.id);
    expect(found).toBeDefined();
    expect(found.like_count).toBe(1);
  });

  it('like_count is in sync with Like documents across many operations', async () => {
    const owner = await createUser();
    const u1 = await createUser();
    const u2 = await createUser();
    const u3 = await createUser();
    const post = await createPublishedPost(owner.token);

    // 3 likes
    await likePost(u1.token, post.id);
    await likePost(u2.token, post.id);
    await likePost(u3.token, post.id);

    // 1 unlike
    await unlikePost(u2.token, post.id);

    // Check sync
    const dbPost = await Post.findById(post.id);
    const dbLikes = await Like.countDocuments({ post: post.id });
    expect(dbPost.like_count).toBe(2);
    expect(dbLikes).toBe(2);
  });
});
