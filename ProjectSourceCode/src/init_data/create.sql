CREATE SCHEMA buffspace_main;

DROP TABLE IF EXISTS buffspace_main.user;
CREATE TABLE buffspace_main.user
(
    --
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    confirm_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DROP TABLE IF EXISTS buffspace_main.profile_song;
CREATE TABLE buffspace_main.profile_song
(
    song_id SERIAL PRIMARY KEY,
    song_title VARCHAR(255) NOT NULL,
    song_album VARCHAR(255),
    song_artist VARCHAR(255),
    spotify_url VARCHAR(255) NOT NULL,
    spotify_image_url VARCHAR(255) NOT NULL,
    constraint song_ak
        unique (song_title, song_artist)
);

DROP TABLE IF EXISTS buffspace_main.profile;
CREATE TABLE buffspace_main.profile
(
    profile_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL CONSTRAINT profile_user_user_id_fk REFERENCES buffspace_main.user ON DELETE CASCADE,
    bio VARCHAR(255),
    profile_picture_url VARCHAR(255),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    graduation_year INT,
    major VARCHAR(255),
    song_id INT CONSTRAINT profile_song_song_id_fk REFERENCES buffspace_main.profile_song ON UPDATE cascade ON DELETE SET NULL,
    status VARCHAR(255),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

create table buffspace_main.post
(
    post_id    SERIAL
        constraint post_pk
            primary key,
    user_id    INT                                not null
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
    post_id    INT                             not null
        constraint comment_post_post_id_fk
            references buffspace_main.post
            on delete cascade,
    user_id    INT                             not null
        constraint comment_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    content    varchar(500)                        not null,
    created_at timestamp default current_timestamp not null
);

create table buffspace_main.friend
(
    user_id_1      INT                             not null
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
