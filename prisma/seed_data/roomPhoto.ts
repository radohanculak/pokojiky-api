import * as faker from 'faker';

const roomPhoto = (isMain?: boolean) => ({
  path: faker.image.dataUri(500, 300, faker.internet.color()),
  isMain: isMain === undefined ? faker.datatype.boolean() : isMain,
});

export default roomPhoto;
