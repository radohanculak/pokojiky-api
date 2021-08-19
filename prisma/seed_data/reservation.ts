import * as faker from 'faker';
import user from './user';

const reservation = () => ({
  from: faker.date.soon(),
  to: faker.date.future(),
  guest: {
    create: user(),
  },
});

export default reservation;
