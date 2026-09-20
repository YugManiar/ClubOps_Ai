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

-- One completed event with feedback so the rating UI has data to show.
-- (average_rating / rating_count are filled in by the trigger.)
insert into events (id, club_id, name, description, location, start_time, status) values
  ('33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'Intro to Git Workshop',
   'Beginner workshop on version control.',
   'Lab 204',
   now() - interval '14 days',
   'completed');

insert into feedback (event_id, member_id, rating, raw_comment, validated_comment, is_constructive)
select '33333333-3333-3333-3333-333333333333', m.id, v.rating, v.comment, v.comment, true
from (values
  ('priya@club.edu', 5, 'Clear pacing and great live demos.'),
  ('dev@club.edu',   4, 'Good content, but the room was too small for the turnout.')
) as v(email, rating, comment)
join members m on m.email = v.email;
