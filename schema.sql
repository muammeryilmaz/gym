-- D1 schema for Güray Pilates Salonu
CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  instructorId TEXT NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  FOREIGN KEY (instructorId) REFERENCES instructors(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  instructorId TEXT NOT NULL,
  clientId TEXT NOT NULL,
  method TEXT NOT NULL,
  time TEXT NOT NULL,
  date TEXT,
  dayOfWeek TEXT,
  daysOfMonth TEXT,
  exclusions TEXT,
  FOREIGN KEY (instructorId) REFERENCES instructors(id),
  FOREIGN KEY (clientId) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_clients_instructor ON clients(instructorId);
CREATE INDEX IF NOT EXISTS idx_bookings_instructor ON bookings(instructorId);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(clientId);
