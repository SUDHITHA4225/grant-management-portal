const request = require('supertest');
const { app, pool, initializeDatabase } = require('../src/app');

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  await pool.end();
});

describe('Grant Management Portal API', () => {
  let adminToken;
  let grantorToken;
  let granteeToken;
  let grantId;
  let createdUserId;

  test('health endpoint works', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  test('registers a user', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@example.com', password: 'Password123!' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('alice@example.com');
    createdUserId = res.body.id;
  });

  test('logs in as admin', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'AdminPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    adminToken = res.body.accessToken;
  });

  test('assigns role to a user', async () => {
    const res = await request(app).post(`/api/users/${createdUserId}/roles`).set('Authorization', `Bearer ${adminToken}`).send({ roleName: 'GRANTOR' });
    expect(res.status).toBe(200);
  });

  test('logs in as grantor', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'Password123!' });
    expect(res.status).toBe(200);
    grantorToken = res.body.accessToken;
  });

  test('creates a grant', async () => {
    const res = await request(app).post('/api/grants').set('Authorization', `Bearer ${grantorToken}`).send({ title: 'Seed Grant', description: 'For community projects' });
    expect(res.status).toBe(201);
    grantId = res.body.id;
  });

  test('updates a grant', async () => {
    const res = await request(app).put(`/api/grants/${grantId}`).set('Authorization', `Bearer ${grantorToken}`).send({ title: 'Updated Grant' });
    expect(res.status).toBe(200);
  });

  test('denies unauthorized access', async () => {
    const res = await request(app).post('/api/grants').send({ title: 'Nope', description: 'Nope' });
    expect(res.status).toBe(401);
  });

  test('denies forbidden access', async () => {
    const res = await request(app).post('/api/grants').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Nope', description: 'Nope' });
    expect(res.status).toBe(403);
  });

  test('allows grantee to view grants and apply', async () => {
    const createGrantee = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@example.com', password: 'Password123!' });
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'Password123!' });
    granteeToken = loginRes.body.accessToken;
    const grantsRes = await request(app).get('/api/grants').set('Authorization', `Bearer ${granteeToken}`);
    expect(grantsRes.status).toBe(200);
    const applyRes = await request(app).post(`/api/grants/${grantId}/apply`).set('Authorization', `Bearer ${granteeToken}`).send({ proposal: 'Great proposal' });
    expect(applyRes.status).toBe(201);
  });

  test('grantor can view applications for their grant', async () => {
    const res = await request(app).get(`/api/grants/${grantId}/applications`).set('Authorization', `Bearer ${grantorToken}`);
    expect(res.status).toBe(200);
  });
});
