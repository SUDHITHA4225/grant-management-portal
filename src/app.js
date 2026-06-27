const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

class MemoryPool {
  constructor() {
    this.state = {
      roles: [{ id: 1, name: 'ADMIN' }, { id: 2, name: 'GRANTOR' }, { id: 3, name: 'GRANTEE' }],
      users: [],
      userRoles: [],
      grants: [],
      applications: []
    };
    this.nextIds = { user: 1, grant: 1, application: 1 };
  }

  normalizeId(value) {
    return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  }

  async query(sql, params = []) {
    if (sql.startsWith('CREATE TABLE')) {
      return { rows: [] };
    }

    if (sql.startsWith('SELECT 1')) {
      return { rows: [{ '?column?': 1 }] };
    }

    if (sql.startsWith('INSERT INTO roles')) {
      const name = params[0];
      if (!this.state.roles.some((role) => role.name === name)) {
        const role = { id: this.state.roles.length + 1, name };
        this.state.roles.push(role);
      }
      return { rows: [] };
    }

    if (sql.startsWith('SELECT id FROM users WHERE email')) {
      const email = params[0];
      const user = this.state.users.find((entry) => entry.email === email);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    if (sql.startsWith('SELECT id FROM roles WHERE name')) {
      const name = params[0];
      const role = this.state.roles.find((entry) => entry.name === name);
      return { rows: role ? [{ id: role.id }] : [] };
    }

    if (sql.startsWith('INSERT INTO user_roles')) {
      const [userId, roleId] = params;
      const normalizedUserId = this.normalizeId(userId);
      const normalizedRoleId = this.normalizeId(roleId);
      const exists = this.state.userRoles.some((entry) => entry.user_id === normalizedUserId && entry.role_id === normalizedRoleId);
      if (!exists) {
        this.state.userRoles.push({ user_id: normalizedUserId, role_id: normalizedRoleId });
      }
      return { rows: [] };
    }

    if (sql.startsWith('SELECT id, name, email FROM users WHERE id')) {
      const user = this.state.users.find((entry) => entry.id === this.normalizeId(params[0]));
      return { rows: user ? [{ id: user.id, name: user.name, email: user.email }] : [] };
    }

    if (sql.startsWith('SELECT id, name, email, password_hash FROM users WHERE email')) {
      const email = params[0];
      const user = this.state.users.find((entry) => entry.email === email);
      return { rows: user ? [{ id: user.id, name: user.name, email: user.email, password_hash: user.password_hash }] : [] };
    }

    if (sql.startsWith('SELECT id, name, email FROM users WHERE oauth_provider')) {
      const [, oauthId] = params;
      const user = this.state.users.find((entry) => entry.oauth_provider === params[0] && entry.oauth_id === oauthId);
      return { rows: user ? [{ id: user.id, name: user.name, email: user.email }] : [] };
    }

    if (sql.startsWith('INSERT INTO users(name, email, password_hash)')) {
      const [name, email, passwordHash] = params;
      const user = { id: this.nextIds.user++, name, email, password_hash: passwordHash };
      this.state.users.push(user);
      return { rows: [{ id: user.id, name: user.name, email: user.email }] };
    }

    if (sql.startsWith('INSERT INTO users(name, email, oauth_provider, oauth_id)')) {
      const [name, email, provider, oauthId] = params;
      const user = { id: this.nextIds.user++, name, email, oauth_provider: provider, oauth_id: oauthId };
      this.state.users.push(user);
      return { rows: [{ id: user.id, name: user.name, email: user.email }] };
    }

    if (sql.startsWith('SELECT r.name FROM user_roles ur')) {
      const userId = this.normalizeId(params[0]);
      const roles = this.state.userRoles
        .filter((entry) => entry.user_id === userId)
        .map((entry) => this.state.roles.find((role) => role.id === entry.role_id))
        .filter(Boolean)
        .map((role) => role.name);
      return { rows: roles.map((name) => ({ name })) };
    }

    if (sql.startsWith('INSERT INTO grants')) {
      const [title, description, ownerId] = params;
      const grant = { id: this.nextIds.grant++, title, description, owner_id: this.normalizeId(ownerId), created_at: new Date().toISOString() };
      this.state.grants.push(grant);
      return { rows: [grant] };
    }

    if (sql.startsWith('SELECT * FROM grants WHERE id')) {
      const grant = this.state.grants.find((entry) => entry.id === this.normalizeId(params[0]));
      return { rows: grant ? [grant] : [] };
    }

    if (sql.startsWith('SELECT * FROM grants ORDER BY created_at DESC')) {
      return { rows: [...this.state.grants].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    if (sql.startsWith('UPDATE grants SET title')) {
      const [title, description, grantId] = params;
      const index = this.state.grants.findIndex((entry) => entry.id === this.normalizeId(grantId));
      if (index >= 0) {
        this.state.grants[index] = {
          ...this.state.grants[index],
          title: title ?? this.state.grants[index].title,
          description: description ?? this.state.grants[index].description
        };
        return { rows: [this.state.grants[index]] };
      }
      return { rows: [] };
    }

    if (sql.startsWith('DELETE FROM grants WHERE id')) {
      const grantId = this.normalizeId(params[0]);
      this.state.grants = this.state.grants.filter((entry) => entry.id !== grantId);
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO applications')) {
      const [grantId, applicantId, proposal] = params;
      const application = { id: this.nextIds.application++, grant_id: this.normalizeId(grantId), applicant_id: this.normalizeId(applicantId), proposal, created_at: new Date().toISOString() };
      this.state.applications.push(application);
      return { rows: [application] };
    }

    if (sql.startsWith('SELECT a.*, u.name AS applicant_name')) {
      const grantId = this.normalizeId(params[0]);
      const rows = this.state.applications
        .filter((entry) => entry.grant_id === grantId)
        .map((entry) => {
          const applicant = this.state.users.find((user) => user.id === entry.applicant_id);
          return { ...entry, applicant_name: applicant ? applicant.name : null, applicant_email: applicant ? applicant.email : null };
        });
      return { rows };
    }

    return { rows: [] };
  }

  async end() {
    return true;
  }
}

let pool = new Pool({ connectionString: process.env.DATABASE_URL });
let useMemoryStore = false;

async function ensureDatabaseConnection() {
  if (useMemoryStore) return;
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    pool = new MemoryPool();
    useMemoryStore = true;
  }
}

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const roles = ['ADMIN', 'GRANTOR', 'GRANTEE'];

async function initializeDatabase() {
  await ensureDatabaseConnection();
  if (useMemoryStore) {
    await pool.query('CREATE TABLE IF NOT EXISTS roles');
    await pool.query('CREATE TABLE IF NOT EXISTS users');
    await pool.query('CREATE TABLE IF NOT EXISTS user_roles');
    await pool.query('CREATE TABLE IF NOT EXISTS grants');
    await pool.query('CREATE TABLE IF NOT EXISTS applications');

    for (const role of roles) {
      await pool.query('INSERT INTO roles(name) VALUES ($1)', [role]);
    }

    const adminEmail = 'admin@example.com';
    const adminRes = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (adminRes.rows.length === 0) {
      const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPass123!', 10);
      const adminInsert = await pool.query('INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['Admin', adminEmail, hash]);
      const adminId = adminInsert.rows[0].id;
      const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['ADMIN']);
      await pool.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [adminId, roleRes.rows[0].id]);
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS grants (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        grant_id INTEGER REFERENCES grants(id) ON DELETE CASCADE,
        applicant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        proposal TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const role of roles) {
      await client.query(`INSERT INTO roles(name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [role]);
    }

    const adminEmail = 'admin@example.com';
    const adminRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (adminRes.rows.length === 0) {
      const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPass123!', 10);
      const adminInsert = await client.query('INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['Admin', adminEmail, hash]);
      const adminId = adminInsert.rows[0].id;
      const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', ['ADMIN']);
      await client.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [adminId, roleRes.rows[0].id]);
    }
  } finally {
    client.release();
  }
}

function getToken(user) {
  return jwt.sign({ userId: user.id, roles: user.roles }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
}

function authMiddleware(requiredRole) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.userId]);
      if (userRes.rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });

      const roleRes = await pool.query('SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [decoded.userId]);
      const roles = roleRes.rows.map((row) => row.name);
      req.user = { id: decoded.userId, roles };

      if (requiredRole && !roles.includes(requiredRole)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email', [name, email, hash]);
    const user = result.rows[0];
    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['GRANTEE']);
    await pool.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [user.id, roleRes.rows[0].id]);
    return res.status(201).json(user);
  } catch (err) {
    return res.status(400).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const userRes = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const roleRes = await pool.query('SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [user.id]);
    const roles = roleRes.rows.map((row) => row.name);
    return res.json({ accessToken: getToken({ id: user.id, roles }) });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/google', (req, res) => {
  const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  const url = `${process.env.OAUTH_PROVIDER === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : ''}?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile`;
  res.redirect(url);
});

app.get('/api/auth/provider/callback', async (req, res) => {
  const { code } = req.query;
  const provider = req.query.provider || 'google';
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const tokenResponse = await fetch(process.env.OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.OAUTH_CLIENT_ID || '',
        client_secret: process.env.OAUTH_CLIENT_SECRET || '',
        redirect_uri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenResponse.json();
    const userInfoResponse = await fetch(process.env.OAUTH_USERINFO_URL || 'https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userInfoResponse.json();
    let userRes = await pool.query('SELECT id, name, email FROM users WHERE oauth_provider = $1 AND oauth_id = $2', [provider, userInfo.sub || userInfo.id]);
    if (userRes.rows.length === 0) {
      const insert = await pool.query('INSERT INTO users(name, email, oauth_provider, oauth_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email', [userInfo.name || 'OAuth User', userInfo.email || `${userInfo.sub || userInfo.id}@oauth.local`, provider, userInfo.sub || userInfo.id]);
      userRes = { rows: [insert.rows[0]] };
      const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['GRANTEE']);
      await pool.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [userRes.rows[0].id, roleRes.rows[0].id]);
    }
    const user = userRes.rows[0];
    const roleRes = await pool.query('SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [user.id]);
    const token = getToken({ id: user.id, roles: roleRes.rows.map((row) => row.name) });
    return res.json({ accessToken: token });
  } catch (err) {
    return res.status(500).json({ error: 'OAuth failed' });
  }
});

app.post('/api/users/:userId/roles', authMiddleware('ADMIN'), async (req, res) => {
  const { roleName } = req.body;
  if (!roleName) return res.status(400).json({ error: 'roleName required' });
  const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
  if (roleRes.rows.length === 0) return res.status(400).json({ error: 'Invalid role' });
  await pool.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [req.params.userId, roleRes.rows[0].id]);
  return res.json({ success: true });
});

app.post('/api/grants', authMiddleware('GRANTOR'), async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Missing fields' });
  const result = await pool.query('INSERT INTO grants(title, description, owner_id) VALUES ($1, $2, $3) RETURNING *', [title, description, req.user.id]);
  return res.status(201).json(result.rows[0]);
});

app.put('/api/grants/:grantId', authMiddleware('GRANTOR'), async (req, res) => {
  const { title, description } = req.body;
  const grantRes = await pool.query('SELECT * FROM grants WHERE id = $1', [req.params.grantId]);
  if (grantRes.rows.length === 0) return res.status(404).json({ error: 'Grant not found' });
  if (grantRes.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const result = await pool.query('UPDATE grants SET title = COALESCE($1, title), description = COALESCE($2, description) WHERE id = $3 RETURNING *', [title, description, req.params.grantId]);
  return res.json(result.rows[0]);
});

app.delete('/api/grants/:grantId', authMiddleware('GRANTOR'), async (req, res) => {
  const grantRes = await pool.query('SELECT * FROM grants WHERE id = $1', [req.params.grantId]);
  if (grantRes.rows.length === 0) return res.status(404).json({ error: 'Grant not found' });
  if (grantRes.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM grants WHERE id = $1', [req.params.grantId]);
  return res.json({ success: true });
});

app.get('/api/grants', authMiddleware(), async (req, res) => {
  const result = await pool.query('SELECT * FROM grants ORDER BY created_at DESC');
  return res.json(result.rows);
});

app.post('/api/grants/:grantId/apply', authMiddleware('GRANTEE'), async (req, res) => {
  const { proposal } = req.body;
  if (!proposal) return res.status(400).json({ error: 'Proposal required' });
  const grantRes = await pool.query('SELECT * FROM grants WHERE id = $1', [req.params.grantId]);
  if (grantRes.rows.length === 0) return res.status(404).json({ error: 'Grant not found' });
  const result = await pool.query('INSERT INTO applications(grant_id, applicant_id, proposal) VALUES ($1, $2, $3) RETURNING *', [req.params.grantId, req.user.id, proposal]);
  return res.status(201).json(result.rows[0]);
});

app.get('/api/grants/:grantId/applications', authMiddleware('GRANTOR'), async (req, res) => {
  const grantRes = await pool.query('SELECT * FROM grants WHERE id = $1', [req.params.grantId]);
  if (grantRes.rows.length === 0) return res.status(404).json({ error: 'Grant not found' });
  if (grantRes.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const result = await pool.query('SELECT a.*, u.name AS applicant_name, u.email AS applicant_email FROM applications a JOIN users u ON u.id = a.applicant_id WHERE a.grant_id = $1 ORDER BY a.created_at DESC', [req.params.grantId]);
  return res.json(result.rows);
});

if (require.main === module) {
  initializeDatabase().then(() => {
    app.listen(port, () => console.log(`Server running on port ${port}`));
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, pool, initializeDatabase, getToken };
