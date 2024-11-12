INSERT INTO buffspace_main.user
  (user_id, username, password, created_at, last_login)
VALUES
  (
	1,
    'orange',
    'abcdefg',
    '2024-06-24 12:34:56', 
    '2024-06-24 12:34:56'
  );

INSERT INTO buffspace_main.profile
  (profile_id, user_id, bio, profile_picture_url, first_name, last_name, graduation_year, major, song_id, status, last_updated)
VALUES
  (
    1, -- profile_id
    1, -- user_id (should correspond to an existing user)
    'I AM CHIP', -- bio
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmIo42UGDaWsRLggK0jDKeUhcwRe39QyC8hg&s', -- profile_picture_url
    'CHIP', -- first_name
    'BUFFALO', -- last_name
    2024, -- graduation_year
    'IM CHIP', -- major
    NULL, -- song_id (provide a valid value or NULL if applicable)
    'Active', -- status
    DEFAULT -- last_updated (or provide a specific timestamp if needed)
  );