CREATE SCHEMA buffspace_main;

create table buffspace_main.user
(
    --
    user_id    SERIAL
        constraint user_pk
            primary key,
    username   varchar(50)                         not null,
    password   varchar(255)                        not null,
    created_at timestamp default current_timestamp not null,
    last_login timestamp default current_timestamp not null,
    constraint username_ak
        unique (username)
);

CREATE TABLE buffspace_main.majors
(
    major_id    SERIAL
        constraint majors_pk
            primary key,
    major_name  varchar(100) not null
);

CREATE TABLE buffspace_main.student_majors
(
    major_id integer
        constraint student_majors_major_id_fk
            references buffspace_main.majors
            on delete cascade,
    user_id integer
        constraint student_majors_user_id_fk
            references buffspace_main.user
            on delete cascade
);

create table buffspace_main.courses
(
    course_id   numeric
        constraint courses_pk
            primary key,
    course_name varchar(100) not null
);

create table buffspace_main.student_courses
(
    course_id  integer
        constraint student_courses_courses_course_id_fk
            references buffspace_main.courses
            on delete cascade,
    user_id integer
        constraint student_courses_user_user_id_fk
            references buffspace_main.user
            on delete cascade
);

CREATE TABLE buffspace_main.profile_song
(
    song_id           SERIAL PRIMARY KEY,
    song_title        VARCHAR(255) NOT NULL,
    mp3_file_url      VARCHAR(255), -- Path to the uploaded MP3 file
    CONSTRAINT song_ak UNIQUE (song_title, song_artist)
);

create table buffspace_main.profile
(
    profile_id          SERIAL
        constraint profile_pk
            primary key,
    user_id             integer not null
        constraint profile_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    bio                 varchar(255),
    profile_picture_url varchar(255),
    first_name          varchar(50),
    last_name           varchar(50),
    graduation_year     smallint,
    song_id             integer
        constraint profile_song_song_id_fk
            references buffspace_main.profile_song
            on update cascade on delete set null,
    status              varchar(255),
    last_updated        timestamp default current_timestamp not null
);

create table buffspace_main.post
(
    post_id    SERIAL
        constraint post_pk
            primary key,
    user_id    integer                                not null
        constraint post_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    content    varchar(500) default ''                not null,
    image_url  varchar(255),
    created_at timestamp    default current_timestamp not null
);

create table buffspace_main.comment
(
    comment_id SERIAL
        constraint comment_pk
            primary key,
    post_id    integer                             not null
        constraint comment_post_post_id_fk
            references buffspace_main.post
            on delete cascade,
    user_id    integer                             not null
        constraint comment_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    content    varchar(500)                        not null,
    created_at timestamp default current_timestamp not null
);

create table buffspace_main.friend
(
    user_id_1      integer                             not null
        constraint friend_user_1_user_id_fk
            references buffspace_main.user
            on delete cascade,
    user_id_2      integer                             not null
        constraint friend_user_2_user_id_fk
            references buffspace_main.user
            on delete cascade,
    user_1_ranking smallint,
    user_2_ranking smallint,
    created_at     timestamp default current_timestamp not null
);

create table buffspace_main.message
(
    message_id      SERIAL
        constraint message_pk
            primary key,
    from_user_id integer
        constraint message_user_user_id_fk_2
            references buffspace_main."user"
            on update cascade on delete set null,
    to_user_id   integer
        constraint message_user_user_id_fk
            references buffspace_main."user"
            on update set null on delete set null,
    content      varchar(500) default ''                not null,
    image_url    integer,
    created_at   timestamp    default current_timestamp not null
);
