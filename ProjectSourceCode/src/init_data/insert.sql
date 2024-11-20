INSERT INTO buffspace_main.user
  (user_id, username, password, last_login)
VALUES
    (1,'orange','abcdefg','2024-06-24 12:34:56'),
    (2,'alice','cheez', DEFAULT),
    (3,'bob','cheez', DEFAULT),
    (4,'charlie','cheez', DEFAULT),
    (5,'david','cheez', DEFAULT),
    (6,'emma','cheez', DEFAULT),
    (7,'fiona','cheez', DEFAULT),
    (8,'george','cheez', DEFAULT),
    (9,'hannah','cheez', DEFAULT),
    (10,'CamTheRam','beef', DEFAULT);

INSERT INTO buffspace_main.profile
  (user_id, bio, profile_picture_url, first_name, last_name, graduation_year, major, status)
VALUES
  (
    1, -- profile_id
    'I AM CHIP', -- bio
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmIo42UGDaWsRLggK0jDKeUhcwRe39QyC8hg&s', -- profile_picture_url
    'CHIP', -- first_name
    'BUFFALO', -- last_name
    2024, -- graduation_year
    'IM CHIP', -- major
    'Active' -- status
  );

INSERT INTO buffspace_main.profile (user_id, first_name, last_name, profile_picture_url)
VALUES
    (2, 'Alice', 'Smith', 'https://img.freepik.com/premium-vector/avatar-minimalist-line-art-icon-logo-symbol-black-color-only_925376-257641.jpg'),
    (3, 'Bob', 'Johnson', 'https://img.freepik.com/premium-vector/boy-minimalist-line-art-icon-logo-symbol-black-color-only_925376-259120.jpg'),
    (4, 'Charlie', 'Dylanson', 'https://content.wepik.com/statics/20269019/preview-page3.jpg'),
    (5, 'David', 'Davidson', 'https://content.wepik.com/statics/20269016/preview-page1.jpg'),
    (6, 'Emma', 'Lopez', 'https://content.wepik.com/statics/20269016/preview-page1.jpg'),
    (7, 'Fiona', 'Shrek', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTo9tUMVlpZVjqC2ympZR0fOHZJDfmqQev8JTqDcoO6hSqk9kpCczZTDgPH_PYakXPFf6o&usqp=CAU'),
    (8, 'George', 'Georgish', 'https://content.wepik.com/statics/21209543/preview-page6.jpg'),
    (9, 'Hannah', 'Banana', 'https://content.wepik.com/statics/21209540/preview-page3.jpg'),
    (10, 'CAM', 'the Ram', 'https://mascothalloffame.com/wp-content/uploads/bb-plugin/cache/cam-e1678881220838-circle' ||
                           '.jpg');


INSERT INTO buffspace_main.friend (user_id_1, user_id_2, user_1_ranking, user_2_ranking)
VALUES
    (1, 2, 1, 1),
    (1, 3, 1, 2),
    (1, 4, 1, 3),
    (1, 5, 1, 4),
    (1, 6, 1, 5),
    (1, 7, 1, 6),
    (1, 8, 1, 7),
    (1, 9, 1, 8);

INSERT INTO buffspace_main.post (user_id, content, image_url, created_at)
VALUES
    (2, 'oh lawd he comin', 'https://i.redd.it/6uk0m6nclyd21.jpg', '2024-11-07 12:34:56'),
    (3, 'he do a thonk', 'https://pbs.twimg.com/media/FxBERTuWYAEPqSU.jpg:large', '2024-11-05 08:22:01'),
    (10, 'hopefully no one notices me', NULL, '2024-09-14 17:30:05');

INSERT INTO buffspace_main.message (from_user_id, to_user_id, content, created_at)
VALUES
    (4, 1, 'Two Bangs, three adderalls, one brain cell', '2024-11-02 3:33:33'),
    (8, 1, 'Monster? More like NyQuil', '2024-11-07 12:34:56'),
    (3, 1, 'My hummer''s in the shop', '2024-11-05 08:22:56');

/* This needs to be the last part of file */
SELECT setval('buffspace_main.user_user_id_seq', (SELECT MAX(user_id) FROM buffspace_main.user) + 1);
SELECT setval('buffspace_main.post_post_id_seq', (SELECT MAX(post_id) FROM buffspace_main.post) + 1);
SELECT setval('buffspace_main.profile_profile_id_seq', (SELECT MAX(profile_id) FROM buffspace_main.profile) + 1);