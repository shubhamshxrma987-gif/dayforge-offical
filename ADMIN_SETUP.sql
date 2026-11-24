-- First sign up with shubhamshxrma987@gmail.com and verify that email.
-- In Supabase SQL Editor, verify the matching Auth account is confirmed:
select id, email, email_confirmed_at from auth.users
where lower(email) = 'shubhamshxrma987@gmail.com';
-- Only run the UPDATE below after confirming the email and checking the row above.
update public.profiles
set role = 'admin'
where lower(email) = 'shubhamshxrma987@gmail.com'
  and id in (select id from auth.users where email_confirmed_at is not null);
-- Confirm that exactly the intended account has admin access:
select id, email, role from public.profiles
where lower(email) = 'shubhamshxrma987@gmail.com';
