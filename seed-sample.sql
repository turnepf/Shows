-- Sample data to get started. Replace with your own shows!

-- What We're Watching
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('The Night Agent', 'Netflix', NULL, '7.4', 'watching', NULL, 0);
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('Slow Horses', 'Apple TV', NULL, '8.3', 'watching', NULL, 0);
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('Hacks', 'HBO', 'Book Club', '8.2', 'watching', NULL, 0);

-- Waiting on Next Season
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('Silo', 'Apple TV', NULL, '8.1', 'waiting', NULL, 0);
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('The Bear', 'Hulu', NULL, '8.5', 'waiting', NULL, 0);

-- What We're Recommending
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('Adolescence', 'Netflix', NULL, '8.1', 'recommending', NULL, 0);
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('The Instigators', 'Apple TV', NULL, '6.2', 'recommending', NULL, 1);

-- What We're Watching Next
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('Dark', 'Netflix', 'Sarah', '8.7', 'next', NULL, 0);
INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES ('What We Do in the Shadows', 'Hulu', NULL, '7.6', 'next', NULL, 0);
