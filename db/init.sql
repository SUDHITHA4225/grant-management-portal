CREATE EXTENSION IF NOT EXISTS citext;

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

INSERT INTO roles(name) VALUES ('ADMIN') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles(name) VALUES ('GRANTOR') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles(name) VALUES ('GRANTEE') ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com') THEN
    INSERT INTO users(name, email, password_hash)
    VALUES ('Admin', 'admin@example.com', '$2a$10$Yf1YdA7gOGUt4vDxZ9N5R.6tBUIfv9vD3m1k3eTli6sO5f9G8tC1m');
  END IF;
END $$;

DO $$
DECLARE
  admin_id INTEGER;
  admin_role_id INTEGER;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'admin@example.com';
  SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN';
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = admin_id AND role_id = admin_role_id) THEN
    INSERT INTO user_roles(user_id, role_id) VALUES (admin_id, admin_role_id);
  END IF;
END $$;
