-- مِضمار v2: initial Cloudflare D1 schema
-- Apply only to the isolated midmar-dev database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  hash TEXT,
  email TEXT,
  provider TEXT,
  provider_sub TEXT,
  onboarding_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  teacher_id INTEGER,
  created INTEGER,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER,
  title TEXT,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  time_limit INTEGER DEFAULT 0,
  shuffle_q INTEGER DEFAULT 0,
  shuffle_a INTEGER DEFAULT 0,
  show_correct INTEGER DEFAULT 1,
  allow_retry INTEGER DEFAULT 0,
  participation_mode TEXT DEFAULT 'groups',
  entry_mode TEXT DEFAULT 'both',
  progression_mode TEXT DEFAULT 'sequential',
  unlocked_question INTEGER DEFAULT 0,
  start_at INTEGER,
  end_at INTEGER,
  code TEXT UNIQUE,
  archived INTEGER DEFAULT 0,
  board TEXT DEFAULT 'shown',
  created INTEGER,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  quiz_id INTEGER,
  pos INTEGER,
  type TEXT,
  text TEXT,
  image TEXT DEFAULT '',
  points INTEGER DEFAULT 1,
  options TEXT,
  correct INTEGER,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  quiz_id INTEGER,
  name TEXT,
  token TEXT UNIQUE,
  seed INTEGER,
  started INTEGER,
  finished INTEGER,
  UNIQUE (quiz_id, name),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY,
  group_id INTEGER,
  question_id INTEGER,
  choice,
  correct INTEGER,
  points INTEGER,
  at INTEGER,
  UNIQUE (group_id, question_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_roster (
  id INTEGER PRIMARY KEY,
  quiz_id INTEGER,
  name TEXT NOT NULL,
  claimed INTEGER DEFAULT 0,
  UNIQUE (quiz_id, name),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_migrations (
  id TEXT PRIMARY KEY,
  applied INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS teachers_oauth_identity
ON teachers(provider, provider_sub)
WHERE provider IS NOT NULL AND provider_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS quizzes_teacher_id ON quizzes(teacher_id);
CREATE INDEX IF NOT EXISTS questions_quiz_id_pos ON questions(quiz_id, pos);
CREATE INDEX IF NOT EXISTS groups_quiz_id ON groups(quiz_id);
CREATE INDEX IF NOT EXISTS answers_group_id ON answers(group_id);
CREATE INDEX IF NOT EXISTS quiz_roster_quiz_id ON quiz_roster(quiz_id);
