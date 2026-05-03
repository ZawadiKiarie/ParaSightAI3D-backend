BEGIN TRANSACTION;

INSERT INTO users (name, email, joined) VALUES ('wes', 'wes@gmail.com','2024-01-01');
INSERT INTO login (hash, email) VALUES ('$2b$10$tJhcW4CMN6dKBLRxan2lZO811VO6BOHcR9VX.2EaNccReXKXUiIT2', 'wes@gmail.com');

COMMIT;