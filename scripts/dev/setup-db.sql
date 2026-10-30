CREATE USER camtech WITH PASSWORD 'camtech123';
CREATE DATABASE "camtechStore" OWNER camtech;
GRANT ALL PRIVILEGES ON DATABASE "camtechStore" TO camtech;
