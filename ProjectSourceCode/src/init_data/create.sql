create schema buffspace_main;

create table buffspace_main.user
(
    --
    user_id    integer
        constraint user_pk
            primary key,
    username   varchar(50)                         not null,
    password   varchar(255)                        not null,
    created_at timestamp default current_timestamp not null,
    last_login timestamp default current_timestamp not null
);

create table buffspace_main.profile
(
    profile_id          integer
        constraint profile_pk
            primary key,
    user_id             integer                             not null
        constraint profile_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    bio                 varchar(255),
    profile_picture_url varchar(255),
    first_name          varchar(50),
    last_name           varchar(50),
    graduation_year     smallint,
    major               varchar(255),
    last_updated        timestamp default current_timestamp not null
);

create table buffspace_main.post
(
    post_id    integer
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
    --
    comment_id integer
        constraint comment_pk
            primary key,
    post_id    integer                             not null
        constraint comment_post_post_id_fk
            references buffspace_main.post
            on delete cascade,
    user_id    integer                             not null
        constraint comment_post_user_id_fk
            references buffspace_main.post (user_id)
            on delete cascade,
    content    varchar(500)                        not null,
    created_at timestamp default current_timestamp not null
);

create table buffspace_main.friend
(
    user_id_1  integer                             not null
        constraint friend_user_1_user_id_fk
            references buffspace_main.user
            on delete cascade,
    user_id_2  integer                             not null
        constraint friend_user_2_user_id_fk
            references buffspace_main.user
            on delete cascade,
    created_at timestamp default current_timestamp not null
);