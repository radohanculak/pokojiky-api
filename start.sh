#!/bin/bash

docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:13-alpine

sleep 2
npm run migrate
npm run seed

echo "DB started & seeded."
