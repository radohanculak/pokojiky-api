import argon2 from 'argon2';
import * as faker from 'faker';

const user = async () => ({
  firstName: faker.name.firstName(),
  lastName: faker.name.lastName(),
  email: faker.internet.email(),
  password: await argon2.hash('password'),
});

export default user;
