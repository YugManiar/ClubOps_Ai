-- Demo fixtures. Run after schema.sql.

insert into clubs (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'ACM Student Chapter');

insert into members (club_id, full_name, email, role) values
  ('11111111-1111-1111-1111-111111111111', 'Priya Nair',   'priya@club.edu',   'lead'),
  ('11111111-1111-1111-1111-111111111111', 'Dev Shah',     'dev@club.edu',     'officer'),
  ('11111111-1111-1111-1111-111111111111', 'Alex Chen',    'alex@club.edu',    'member');

insert into events (id, club_id, name, description, location, start_time, status) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'HackNight 2026',
   'Overnight build event for first-years.',
   'Engineering Atrium',
   now() + interval '10 days',
   'planning');

insert into tasks (event_id, title, description, priority, status) values
  ('22222222-2222-2222-2222-222222222222', 'Book venue', 'Confirm atrium reservation with facilities', 'high', 'todo'),
  ('22222222-2222-2222-2222-222222222222', 'Order pizza', 'Get quotes for 80 people', 'medium', 'todo');
