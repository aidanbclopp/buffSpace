INSERT INTO buffspace_main.user
  (user_id, username, password, last_login)
VALUES
    (1,'ChipTheBuffalo','master_password','2024-06-24 12:34:56'),
    (2,'alice','master_password', DEFAULT),
    (3,'bob','master_password', DEFAULT),
    (4,'charlie','master_password', DEFAULT),
    (5,'david','master_password', DEFAULT),
    (6,'emma','master_password', DEFAULT),
    (7,'fiona','master_password', DEFAULT),
    (8,'george','master_password', DEFAULT),
    (9,'hannah','master_password', DEFAULT),
    (10,'john','master_password', DEFAULT),
    (11,'CamTheRam','master_password', DEFAULT);


INSERT INTO buffspace_main.majors
  (major_id, major_name)
VALUES
  (1, 'Computer Science (BA)'),
  (2, 'Computer Science (BS)'),
  (3, 'Computer Engineering (BS)'),
  (4, 'Electrical Engineering (BS)'),
  (5, 'Mechanical Engineering (BS)'),
  (6, 'Civil Engineering (BS)'),
  (7, 'Chemical Engineering (BS)'),
  (8, 'Biomedical Engineering (BS)'),
  (9, 'Aerospace Engineering (BS)'),
  (10, 'Industrial Engineering (BS)'),
  (11, 'Environmental Engineering (BS)');

INSERT INTO buffspace_main.courses
  (course_id, course_name)
VALUES
  (1000, 'Computer Science as a Field of Work and Study'),
  (1300, 'Introduction to Programming'),
  (1200, 'Introduction to computational thinking'),
  (2270, 'Data Structures'),
  (2400, 'Computer Systems'),
  (3308, 'Software Development Methods and Tools'),
  (2824, 'Discrete Structures'),
  (3104, 'Algorithms'),
  (3155, 'Principles of Programming Languages'),
  (3287, 'Design and Analysis of Database systems'),
  (3753, 'Design and Analysis of Operating systems'),
  (2820, 'Linear Algebra with Computer Science Applications'),
  (3202, 'Introduction to Artificial Intelligence'),
  (3022, 'Introduction to Data Science'),
  (3002, 'Fundamentals of Human Computer Interaction'),
  (3010, 'Intensive Programming Workshop'),
  (4253, 'Data Center Scale Computing'),
  (4273, 'Network Systems'),
  (4308, 'Software Engineering Project 1'),
  (4448, 'Object-Oriented Analysis and Design'),
  (4502, 'Data Mining');


INSERT INTO buffspace_main.profile
  (user_id, bio, profile_picture_url, first_name, last_name, graduation_year, status)
VALUES
  (
    1, -- profile_id
    'University of Colorado #1 Fan', -- bio
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0BJ4xefjotlm_0FV13yDu8ry8ycqwvy9U3A&s',
    'Chip', -- first_name
    'Buffalo', -- last_name
    2028, -- graduation_year
    'Active' -- status
  ),
  (2, 'I love computer science!', 'https://img.freepik.com/premium-vector/avatar-minimalist-line-art-icon-logo-symbol-black-color-only_925376-257641.jpg', 'Alice', 'Smith', 2029, 'Active'),
  (3, 'I am a software engineer.', 'https://img.freepik.com/premium-vector/boy-minimalist-line-art-icon-logo-symbol-black-color-only_925376-259120.jpg', 'Bob', 'Johnson', 2030, 'Active'),
  (4, 'I am a data scientist.', 'https://content.wepik.com/statics/20269019/preview-page3.jpg', 'Charlie', 'Dylanson', 2029, 'Active'),
  (5, 'I am a machine learning engineer.', 'https://content.wepik.com/statics/20269016/preview-page1.jpg', 'David', 'Davidson', 2028, 'Active'),
  (6, 'I am a cybersecurity expert.', 'https://content.wepik.com/statics/20269016/preview-page1.jpg', 'Emma', 'Lopez', 2029, 'Active'),
  (7, 'I am a web developer.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTo9tUMVlpZVjqC2ympZR0fOHZJDfmqQev8JTqDcoO6hSqk9kpCczZTDgPH_PYakXPFf6o&usqp=CAU', 'Fiona', 'Shrek', 2030, 'Active'),
  (8, 'I am a network administrator.', 'https://content.wepik.com/statics/21209543/preview-page6.jpg', 'George', 'Georgish', 2028, 'Active'),
  (9, 'I am a database administrator.', 'https://content.wepik.com/statics/21209540/preview-page3.jpg', 'Hannah', 'Banana', 2029, 'Active'),
  (10, 'I''m a student at CU Boulder!', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7XaUW3hi5dnKpmaEYm5_NoeYeD0XPF0iLFA&s', 'John', 'Doe', 2027, 'Active'),
  (11, 'I am a mascot.', 'https://mascothalloffame.com/wp-content/uploads/bb-plugin/cache/cam-e1678881220838-circle.jpg', 'CAM', 'the Ram', 2028, 'Active');

INSERT INTO buffspace_main.student_majors
    (user_id, major_id)
VALUES
    (1, 1),  
    (2, 2),  
    (3, 1),  
    (4, 3),
    (5, 2),
    (6, 3),
    (7, 1),
    (8, 2),
    (9, 3),
    (10, 1);

INSERT INTO buffspace_main.student_courses
    (user_id, course_id)
VALUES
    (1, 3308),
    (1, 2824),
    (1, 3002),
    (10, 3308),
    (10, 2824),
    (10, 3002);

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