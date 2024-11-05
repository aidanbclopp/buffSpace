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
    --
    profile_id          integer
        constraint profile_pk
            primary key,
    user_id             integer                             not null
        constraint profile_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    bio                 varchar(255),
    profile_picture_url varchar(255),
    last_updated        timestamp default current_timestamp not null
);

create table buffspace_main.post
(
    --
    post_id    integer
        constraint post_pk
            primary key,
    user_id    integer                             not null
        constraint post_user_user_id_fk
            references buffspace_main.user
            on delete cascade,
    content    varchar(500),
    image_url  varchar(255),
    created_at timestamp default current_timestamp not null
);

