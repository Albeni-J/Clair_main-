CREATE TABLE clair_users (
    id          SERIAL PRIMARY KEY,
    login       VARCHAR(50)  NOT NULL UNIQUE,
    password    TEXT         NOT NULL,
    full_name   VARCHAR(150),
    email       VARCHAR(100) UNIQUE,
    tg_push     BOOLEAN      DEFAULT FALSE
);

CREATE TABLE clair_channels (
    id           SERIAL PRIMARY KEY,
    uid          INTEGER NOT NULL,
    channel_key  VARCHAR(100) NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,

    CONSTRAINT fk_channels_user
        FOREIGN KEY (uid)
        REFERENCES clair_users (id)
        ON DELETE CASCADE
);

CREATE TABLE clair_appeal (
    id            SERIAL PRIMARY KEY,
    cid           INTEGER NOT NULL,
    rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
    emotion       VARCHAR(50),
    type          VARCHAR(50),
    status        VARCHAR(30),
    anomaly_type  VARCHAR(50),
    anomaly_com   TEXT,
    ai_com        TEXT,
    org_com       TEXT,

    CONSTRAINT fk_appeal_channel
        FOREIGN KEY (cid)
        REFERENCES clair_channels (id)
        ON DELETE CASCADE
);
