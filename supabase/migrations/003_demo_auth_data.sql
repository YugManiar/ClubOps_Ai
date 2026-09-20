-- Demo data for the role dashboards. Run after 002 and after creating the
-- three demo logins (priya@/dev@/alex@club.edu) in Supabase Auth.
update tasks set assignee_id = (select id from members where email = 'priya@club.edu')
  where title = 'Book venue';
update tasks set assignee_id = (select id from members where email = 'dev@club.edu')
  where title = 'Order pizza';

-- Priya (leader) rates Dev for the completed workshop. The trigger fills in Dev's average_rating.
insert into feedback (event_id, member_id, subject_member_id, rating, raw_comment, validated_comment, is_constructive)
select '33333333-3333-3333-3333-333333333333', p.id, d.id, 5,
       'Dev ran the demos smoothly and kept the room engaged.',
       'Dev ran the demos smoothly and kept the room engaged.', true
from members p, members d where p.email = 'priya@club.edu' and d.email = 'dev@club.edu';
