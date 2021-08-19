import { Type } from '@prisma/client';
import * as faker from 'faker';
import location from './location';
import roomPhoto from './roomPhoto';

const room = () => ({
  name: faker.commerce.productName(),
  type: [Type.PRIVATE_ROOM, Type.SHARED_ROOM, Type.WHOLE_PLACE][Math.floor(Math.random() * 2)],
  description: faker.commerce.productDescription(),
  beds: faker.datatype.number({ min: 1, max: 6 }),
  price: faker.datatype.number({ min: 15, max: 100 }),
  location: {
    create: location(),
  },
  photos: {
    create: [
      roomPhoto(true),
      roomPhoto(false),
      roomPhoto(false),
    ],
  },
});

export default room;
