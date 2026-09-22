const { api, auth, createUser } = require("./helpers/api");

// helpers

const createPost = async (token, overrides = {}) => {
  const res = await api()
    .post("/api/posts")
    .set(auth(token))
    .send({
      title: "Sample Post",
      content: "Some content",
      tags: ["nodejs"],
      ...overrides,
    });
  return res;
};

const publish = (token, id) =>
  api().patch(`/api/posts/${id}/publish`).set(auth(token));

// Create N posts and (optionally) publish them
const seedPosts = async (token, n, { publish: toPublish = true } = {}) => {
  const created = [];
  for (let i = 0; i < n; i++) {
    const res = await createPost(token, {
      title: `Seed Post ${i}`,
      content: `Body ${i}`,
      tags: ["seed"],
    });
    const post = res.body.data.post;
    if (toPublish) await publish(token, post.id);
    created.push(post);
  }
  return created;
};

//  CREATE
describe("POST /api/posts", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await api()
      .post("/api/posts")
      .send({ title: "x", content: "y" });
    expect(res.status).toBe(401);
  });

  it("rejects missing title with 400", async () => {
    const { token } = await createUser();
    const res = await api()
      .post("/api/posts")
      .set(auth(token))
      .send({ content: "y" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/);
  });

  it("rejects missing content with 400", async () => {
    const { token } = await createUser();
    const res = await api()
      .post("/api/posts")
      .set(auth(token))
      .send({ title: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/content/);
  });

  it("creates a post with 201 and state=draft", async () => {
    const { token, user } = await createUser();
    const res = await createPost(token, {
      title: "My Post",
      content: "Body",
      tags: ["Node", " Express "],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.post.title).toBe("My Post");
    expect(res.body.data.post.state).toBe("draft");
    expect(res.body.data.post.author.id).toBe(user.id);
    expect(res.body.data.post.tags.sort()).toEqual(["express", "node"]);
    expect(res.body.data.post.like_count).toBe(0);
    expect(res.body.data.post.comment_count).toBe(0);
  });

  it("ignores client-provided state (always draft)", async () => {
    const { token } = await createUser();
    const res = await createPost(token, { state: "published" });
    expect(res.status).toBe(201);
    expect(res.body.data.post.state).toBe("draft");
  });

  it("ignores client-provided author and like_count", async () => {
    const { token, user } = await createUser();
    const res = await api().post("/api/posts").set(auth(token)).send({
      title: "x",
      content: "y",
      author: "000000000000000000000000",
      like_count: 9999,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.post.author.id).toBe(user.id);
    expect(res.body.data.post.like_count).toBe(0);
  });
});

// GET ONE
describe("GET /api/posts/:id", () => {
  it("returns a published post to anonymous users", async () => {
    const { token } = await createUser();
    const created = (await createPost(token, { title: "Public" })).body.data
      .post;
    await publish(token, created.id);

    const res = await api().get(`/api/posts/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.post.title).toBe("Public");
    expect(res.body.data.post.author).toBeDefined();
    expect(res.body.data.post.author.username).toBeTruthy();
    expect(res.body.data.post.author.password).toBeUndefined();
  });

  it("hides drafts from anonymous users (404)", async () => {
    const { token } = await createUser();
    const draft = (await createPost(token)).body.data.post;

    const res = await api().get(`/api/posts/${draft.id}`);
    expect(res.status).toBe(404);
  });

  it("hides drafts from other authenticated users (404)", async () => {
    const owner = await createUser();
    const stranger = await createUser();

    const draft = (await createPost(owner.token)).body.data.post;

    const res = await api()
      .get(`/api/posts/${draft.id}`)
      .set(auth(stranger.token));
    expect(res.status).toBe(404);
  });

  it("lets the owner retrieve their own draft", async () => {
    const { token } = await createUser();
    const draft = (await createPost(token)).body.data.post;

    const res = await api().get(`/api/posts/${draft.id}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.post.state).toBe("draft");
  });

  it("returns 404 for a nonexistent post", async () => {
    const res = await api().get("/api/posts/000000000000000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await api().get("/api/posts/not-an-id");
    expect(res.status).toBe(400);
  });
});

//  LIST
describe("GET /api/posts", () => {
  it("defaults to limit=20", async () => {
    const { token } = await createUser();
    await seedPosts(token, 5);
    const res = await api().get("/api/posts");
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.limit).toBe(20);
    expect(res.body.data.posts.length).toBe(5);
  });

  it("only returns published posts", async () => {
    const { token } = await createUser();
    await createPost(token, { title: "Draft" }); // stays draft
    await seedPosts(token, 3); // published

    const res = await api().get("/api/posts");
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).not.toContain("Draft");
    expect(titles.length).toBe(3);
  });

  it("paginates correctly", async () => {
    const { token } = await createUser();
    await seedPosts(token, 5);

    const p1 = await api().get("/api/posts?page=1&limit=2");
    const p2 = await api().get("/api/posts?page=2&limit=2");
    const p3 = await api().get("/api/posts?page=3&limit=2");

    expect(p1.body.data.posts.length).toBe(2);
    expect(p2.body.data.posts.length).toBe(2);
    expect(p3.body.data.posts.length).toBe(1);
    expect(p1.body.data.pagination.total).toBe(5);
    expect(p1.body.data.pagination.pages).toBe(3);
  });

  it("searches by title", async () => {
    const { token } = await createUser();

    const target = (await createPost(token, { title: "Zebra Search Target" }))
      .body.data.post;
    await publish(token, target.id);

    const other = (await createPost(token, { title: "Something Else" })).body
      .data.post;
    await publish(token, other.id);

    const res = await api().get("/api/posts?search=zebra");
    expect(res.status).toBe(200);
    expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.posts.some((p) => p.title.toLowerCase().includes("zebra")),
    ).toBe(true);
  });

  it("searches by tag", async () => {
    const { token } = await createUser();
    const p = (
      await createPost(token, { title: "Tagged", tags: ["unique-tag-xyz"] })
    ).body.data.post;
    await publish(token, p.id);

    const res = await api().get("/api/posts?search=unique-tag-xyz");
    expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
  });

  it("searches by author username", async () => {
    const { token, user } = await createUser();
    const p = (await createPost(token)).body.data.post;
    await publish(token, p.id);

    const res = await api().get(`/api/posts?search=${user.username}`);
    expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by exact tag", async () => {
    const { token } = await createUser();
    const a = (await createPost(token, { tags: ["alpha"] })).body.data.post;
    const b = (await createPost(token, { tags: ["beta"] })).body.data.post;
    await publish(token, a.id);
    await publish(token, b.id);

    const res = await api().get("/api/posts?tag=alpha");
    expect(res.body.data.posts.every((p) => p.tags.includes("alpha"))).toBe(
      true,
    );
  });

  it("sorts by timestamp descending by default", async () => {
    const { token } = await createUser();
    await seedPosts(token, 3);

    const res = await api().get("/api/posts");
    const times = res.body.data.posts.map((p) =>
      new Date(p.timestamp).getTime(),
    );
    const isDesc = times.every((t, i) => i === 0 || times[i - 1] >= t);
    expect(isDesc).toBe(true);
  });

  it("sorts by timestamp ascending when requested", async () => {
    const { token } = await createUser();
    await seedPosts(token, 3);

    const res = await api().get("/api/posts?sort=timestamp");
    const times = res.body.data.posts.map((p) =>
      new Date(p.timestamp).getTime(),
    );
    const isAsc = times.every((t, i) => i === 0 || times[i - 1] <= t);
    expect(isAsc).toBe(true);
  });

  it("sorts by -like_count", async () => {
    const { token } = await createUser();
    const liker = await createUser();

    const a = (await createPost(token, { title: "A" })).body.data.post;
    const b = (await createPost(token, { title: "B" })).body.data.post;
    await publish(token, a.id);
    await publish(token, b.id);

    // Give B 2 likes, A 1 like
    await api().post(`/api/posts/${a.id}/like`).set(auth(liker.token));
    await api().post(`/api/posts/${b.id}/like`).set(auth(liker.token));
    // Only one user exists, so both have 1 like. Create a 2nd liker:
    const liker2 = await createUser();
    await api().post(`/api/posts/${b.id}/like`).set(auth(liker2.token));

    const res = await api().get("/api/posts?sort=-like_count");
    expect(res.body.data.posts[0].title).toBe("B");
  });

  it("sorts by -comment_count", async () => {
    const { token } = await createUser();
    const a = (await createPost(token, { title: "A" })).body.data.post;
    const b = (await createPost(token, { title: "B" })).body.data.post;
    await publish(token, a.id);
    await publish(token, b.id);

    // Update comment_count directly
    const Post = require("../src/models/Post");
    await Post.updateOne({ _id: b.id }, { $set: { comment_count: 5 } });

    const res = await api().get("/api/posts?sort=-comment_count");
    expect(res.body.data.posts[0].title).toBe("B");
  });
});

// PUBLISH
describe("PATCH /api/posts/:id/publish", () => {
  it("rejects anonymous with 401", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;
    const res = await api().patch(`/api/posts/${p.id}/publish`);
    expect(res.status).toBe(401);
  });

  it("rejects non-owner with 403", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const p = (await createPost(owner.token)).body.data.post;

    const res = await api()
      .patch(`/api/posts/${p.id}/publish`)
      .set(auth(stranger.token));
    expect(res.status).toBe(403);
  });

  it("lets the owner publish a draft", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;

    const res = await api()
      .patch(`/api/posts/${p.id}/publish`)
      .set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.post.state).toBe("published");
  });

  it("is idempotent — republishing keeps state published with 200", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;
    await publish(token, p.id);

    const res = await publish(token, p.id);
    expect(res.status).toBe(200);
    expect(res.body.data.post.state).toBe("published");
  });

  it("returns 404 for a nonexistent post", async () => {
    const { token } = await createUser();
    const res = await api()
      .patch("/api/posts/000000000000000000000000/publish")
      .set(auth(token));
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const { token } = await createUser();
    const res = await api()
      .patch("/api/posts/not-an-id/publish")
      .set(auth(token));
    expect(res.status).toBe(400);
  });
});

// UPDATE
describe("PATCH /api/posts/:id", () => {
  it("rejects non-owner with 403", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const p = (await createPost(owner.token)).body.data.post;

    const res = await api()
      .patch(`/api/posts/${p.id}`)
      .set(auth(stranger.token))
      .send({ title: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("rejects empty body with 400", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;

    const res = await api()
      .patch(`/api/posts/${p.id}`)
      .set(auth(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it("updates title, content, tags on a draft", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;

    const res = await api()
      .patch(`/api/posts/${p.id}`)
      .set(auth(token))
      .send({ title: "New Title", tags: ["Updated", "updated", "x"] });

    expect(res.status).toBe(200);
    expect(res.body.data.post.title).toBe("New Title");
    expect(res.body.data.post.tags.sort()).toEqual(["updated", "x"]);
  });

  it("updates a published post without changing state", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;
    await publish(token, p.id);

    const res = await api()
      .patch(`/api/posts/${p.id}`)
      .set(auth(token))
      .send({ content: "Updated body" });

    expect(res.status).toBe(200);
    expect(res.body.data.post.content).toBe("Updated body");
    expect(res.body.data.post.state).toBe("published");
  });

  it("ignores non-editable fields silently", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;

    const res = await api()
      .patch(`/api/posts/${p.id}`)
      .set(auth(token))
      .send({ title: "Changed", state: "published", like_count: 999 });

    expect(res.status).toBe(200);
    expect(res.body.data.post.title).toBe("Changed");
    expect(res.body.data.post.state).toBe("draft");
    expect(res.body.data.post.like_count).toBe(0);
  });
});

// DELETE
describe("DELETE /api/posts/:id", () => {
  it("rejects non-owner with 403", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const p = (await createPost(owner.token)).body.data.post;

    const res = await api()
      .delete(`/api/posts/${p.id}`)
      .set(auth(stranger.token));
    expect(res.status).toBe(403);
  });

  it("deletes a draft owned by the requester", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;

    const res = await api().delete(`/api/posts/${p.id}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(p.id);

    const after = await api().get(`/api/posts/${p.id}`).set(auth(token));
    expect(after.status).toBe(404);
  });

  it("deletes a published post owned by the requester", async () => {
    const { token } = await createUser();
    const p = (await createPost(token)).body.data.post;
    await publish(token, p.id);

    const res = await api().delete(`/api/posts/${p.id}`).set(auth(token));
    expect(res.status).toBe(200);
  });

  it("returns 404 for a nonexistent post", async () => {
    const { token } = await createUser();
    const res = await api()
      .delete("/api/posts/000000000000000000000000")
      .set(auth(token));
    expect(res.status).toBe(404);
  });
});

// ============ MY POSTS ============
describe("GET /api/posts/me", () => {
  it("requires authentication", async () => {
    const res = await api().get("/api/posts/me");
    expect(res.status).toBe(401);
  });

  it("returns all of the owner's posts (draft + published)", async () => {
    const { token } = await createUser();
    await createPost(token); // draft
    await createPost(token); // draft
    await seedPosts(token, 2); // published

    const res = await api().get("/api/posts/me").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.posts.length).toBe(4);
  });

  it("never includes other users' posts", async () => {
    const me = await createUser();
    const other = await createUser();

    await createPost(me.token, { title: "Mine" });
    await createPost(other.token, { title: "Not Mine" });

    const res = await api().get("/api/posts/me").set(auth(me.token));
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).toEqual(["Mine"]);
  });

  it("filters by state=draft", async () => {
    const { token } = await createUser();
    await createPost(token);
    await seedPosts(token, 2);

    const res = await api().get("/api/posts/me?state=draft").set(auth(token));
    expect(res.body.data.posts.every((p) => p.state === "draft")).toBe(true);
    expect(res.body.data.posts.length).toBe(1);
  });

  it("filters by state=published", async () => {
    const { token } = await createUser();
    await createPost(token);
    await seedPosts(token, 2);

    const res = await api()
      .get("/api/posts/me?state=published")
      .set(auth(token));
    expect(res.body.data.posts.every((p) => p.state === "published")).toBe(
      true,
    );
    expect(res.body.data.posts.length).toBe(2);
  });

  it("rejects invalid state with 400", async () => {
    const { token } = await createUser();
    const res = await api().get("/api/posts/me?state=garbage").set(auth(token));
    expect(res.status).toBe(400);
  });

  it("paginates", async () => {
    const { token } = await createUser();
    await createPost(token);
    await createPost(token);
    await createPost(token);

    const res = await api()
      .get("/api/posts/me?limit=2&page=2")
      .set(auth(token));
    expect(res.body.data.posts.length).toBe(1);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.pages).toBe(2);
  });
});
