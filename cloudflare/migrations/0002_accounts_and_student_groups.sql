-- مِضمار 2.4: role-based accounts, verified student identity, and reusable student access groups.
PRAGMA foreign_keys = ON;

ALTER TABLE teachers ADD COLUMN role TEXT NOT NULL DEFAULT 'teacher';
ALTER TABLE teachers ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE teachers ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
UPDATE teachers SET display_name=COALESCE(NULLIF(display_name,''),NULLIF(email,''),username) WHERE display_name='';
CREATE UNIQUE INDEX IF NOT EXISTS teachers_email_unique
  ON teachers(email) WHERE email IS NOT NULL AND email<>'';

ALTER TABLE groups ADD COLUMN student_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS groups_quiz_student_unique
  ON groups(quiz_id,student_id) WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS student_groups (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created INTEGER NOT NULL,
  UNIQUE(teacher_id,name),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_group_members (
  student_group_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  PRIMARY KEY(student_group_id,student_id),
  FOREIGN KEY (student_group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_student_groups (
  quiz_id INTEGER NOT NULL,
  student_group_id INTEGER NOT NULL,
  PRIMARY KEY(quiz_id,student_group_id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_group_id) REFERENCES student_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS student_groups_teacher_id ON student_groups(teacher_id);
CREATE INDEX IF NOT EXISTS student_group_members_student_id ON student_group_members(student_id);
CREATE INDEX IF NOT EXISTS quiz_student_groups_group_id ON quiz_student_groups(student_group_id);
