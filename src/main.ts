import argon2 from 'argon2';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fileUpload from 'express-fileupload';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { PrismaClient, Prisma, User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const PORT: number = +(process.env.API_PORT || 3000);
const SECRET = process.env.JWT_SECRET || 'SECRET';
const ISSUER = 'PokojikyAPI';
const AUDIENCE = 'Pokojiky';

const prisma = new PrismaClient();
const app = express();

passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: SECRET,
  issuer: ISSUER,
  audience: AUDIENCE,
}, async (jwtPayload, done) => {
  if (Number.isNaN(+jwtPayload.sub)) {
    done({ error: 'Invalid sub claim' }, false);
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: +jwtPayload.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt !== null) {
    done({ error: 'Unauthorized' }, false);
    return;
  }
  done(null, user);
}));

app.use(passport.initialize());
app.use(cors());
app.use('/static', express.static('./public/'));
app.use(express.json());

// #region RegEx validating functions
const validatePassword = (password: string): boolean => {
  // ASCII 33-126
  const passwordPattern = new RegExp(/^[!-~]{8,}$/);
  return passwordPattern.test(password);
};

const validateEmail = (email: string): boolean => {
  // BUG: accepts email with multiple `@` symbols!
  const emailPattern = new RegExp(/([A-z\-0-9]+.)+@([A-z\-0-9]+.)+[A-z]+/);
  return emailPattern.test(email);
};

const validateRoomType = (room: string): boolean => (room === 'PRIVATE_ROOM' || room === 'SHARED_ROOM' || room === 'WHOLE_PLACE');
// #endregion

const emailInDb = async (_email: string, userId?: number): Promise<boolean> => await prisma.user
  .findFirst({
    where: {
      deletedAt: null,
      email: _email,
      id: {
        not: userId,
      },
    },
  }) !== null;

function checkDates(from: number, to: number, now: number, res: express.Response,
  next: CallableFunction) {
  if (!from || !to) {
    res.status(400).json({ error: 'Invalid date format!' });
    return;
  }

  if (from < now || to <= now || from >= to) {
    res.status(400).json({ error: 'Invalid date interval!' });
    return;
  }

  res.locals.dateFrom = new Date(from);
  res.locals.dateTo = new Date(to);

  next();
}

// #region  Middleware - USERS
async function parseUser(req: express.Request, res: express.Response, next: CallableFunction) {
  if (Number.isNaN(+req.params.userId)) {
    res.status(401).json({ error: 'Invalid userId parameter!' });
    return;
  }

  res.locals.userId = +req.params.userId;
  if (res.locals.userId !== (req.user as User)?.id) {
    res.sendStatus(403);
    return;
  }

  next();
}

async function verifyNewUser(req: express.Request, res: express.Response, next: CallableFunction) {
  if (await emailInDb(req.body.email)) {
    res.status(409).json({ error: `Account with email ${req.body.email} already exists` });
    return;
  }

  if (req.body.firstName === undefined || req.body.lastName === undefined) {
    res.status(400).json({ error: 'Invalid name!' });
    return;
  }

  if (!(/./.test(req.body.firstName) && /./.test(req.body.lastName))) {
    res.status(400).json({ error: 'Invalid name!' });
    return;
  }

  if (!validateEmail(req.body.email)) {
    res.status(400).json({ error: 'Invalid email!' });
    return;
  }

  if (!validatePassword(req.body.password)) {
    res.status(400).json({ error: 'Invalid password!' });
    return;
  }

  // verified data
  res.locals.firstName = req.body.firstName;
  res.locals.lastName = req.body.lastName;
  res.locals.email = req.body.email;
  res.locals.password = await argon2.hash(req.body.password);

  next();
}

async function verifyPassword(req: express.Request, res: express.Response, next: CallableFunction) {
  const user = await prisma.user.findUnique({
    where: {
      id: res.locals.userId,
    },
  });

  try {
    if (!user || user.deletedAt !== null
        || !await argon2.verify(user.password, req.body.passwordVerify)) {
      res.status(401).json({ error: 'Invalid password!' });
      return;
    }
  } catch (e) {
    res.status(500).json({ error: 'Internal error!' });
  }

  next();
}
// #endregion

// #region  Middleware - ROOMS
async function parseRoom(req: express.Request, res: express.Response, next: CallableFunction) {
  if (Number.isNaN(+req.params.roomId)) {
    res.status(400).json({ error: 'Invalid roomId parameter!' });
    return;
  }

  res.locals.roomId = +req.params.roomId;
  next();
}

async function verifyRoomData(req: express.Request, res: express.Response, next: CallableFunction) {
  if (Number.isNaN(+req.body.beds) || Number.isNaN(+req.body.price)) {
    res.status(400).json({ error: 'Invalid bed count/price!' });
    return;
  }

  if (req.body.name === undefined || req.body.name === '') {
    res.status(400).json({ error: 'Room name missing!' });
    return;
  }

  if (req.body.street === undefined || req.body.street === '') {
    res.status(400).json({ error: 'Invalid street name!' });
    return;
  }

  if (req.body.city === undefined || req.body.city === '') {
    res.status(400).json({ error: 'Invalid city name!' });
    return;
  }

  if (req.body.country === undefined || req.body.country === '') {
    res.status(400).json({ error: 'Invalid country name!' });
    return;
  }

  if (!validateRoomType(req.body.type)) {
    res.status(400).json({ error: 'Invalid room type!' });
    return;
  }

  if (req.body.available !== true && req.body.available !== false) {
    res.status(400).json({ error: 'Invalid \'available\' attribute!' });
    return;
  }

  res.locals.name = req.body.name;
  res.locals.type = req.body.type;
  res.locals.available = req.body.available;

  res.locals.street = req.body.street;
  res.locals.city = req.body.city;
  res.locals.country = req.body.country;

  res.locals.beds = +req.body.beds;
  res.locals.price = +req.body.price;
  next();
}

function setRoomTypes(req: express.Request, res: express.Response, next: CallableFunction) {
  if (req.query.type === undefined || req.query.type === '') {
    res.locals.suitableTypes = ['PRIVATE_ROOM', 'SHARED_ROOM', 'WHOLE_PLACE'];
    next();
    return;
  }

  const roomType: string = req.query.type.toString();

  if (!validateRoomType(roomType)) {
    res.status(400).json({ error: `Invalid room type (${req.query.type})!` });
    return;
  }

  res.locals.suitableTypes = [roomType];
  next();
}

function setAvailableDates(req: express.Request, res: express.Response, next: CallableFunction) {
  if (req.query.host !== undefined) {
    next();
    return;
  }

  const from: number = Date.parse(req.query.dateFrom?.toString() || '');
  const to: number = Date.parse(req.query.dateTo?.toString() || '');
  const now: number = Date.now();

  checkDates(from, to, now, res, next);
}
// #endregion

// #region  Middleware - PHOTOS
async function photoInDb(req: express.Request, res: express.Response, next: CallableFunction) {
  if (Number.isNaN(+req.params.photoId)) {
    res.status(400).json({ error: 'Invalid photoId parameter!' });
    return;
  }

  const result = await prisma.roomPhoto.findUnique({
    where: {
      id: +req.params.photoId,
    },
  });

  if (!result || result.deletedAt !== null) {
    res.status(404).json({ error: 'Room photo not in DB!' });
    return;
  }

  res.locals.photoId = +req.params.photoId;
  next();
}
// #endregion

// #region MIddleware - RESERVATIONS
async function validateDates(req: express.Request, res: express.Response, next: CallableFunction) {
  const from: number = Date.parse(req.body.dateFrom?.toString() || '');
  const to: number = Date.parse(req.body.dateTo?.toString() || '');
  const now: number = Date.now();

  checkDates(from, to, now, res, next);
}

async function reservationExists(req: express.Request, res: express.Response,
  next: CallableFunction) {
  if (req.params.reservationId === undefined || Number.isNaN(+req.params.reservationId)) {
    res.status(400).json({ error: 'Invalid reservation ID!' });
    return;
  }

  res.locals.reservationId = +req.params.reservationId;

  const existsReservation: boolean = await prisma.reservation.findFirst({
    where: { id: res.locals.reservationId },
  }) !== null;

  if (!existsReservation) {
    res.status(400).json({ error: `Reservation id: ${res.locals.reservationId} doesn't exist!` });
    return;
  }

  next();
}

function setReservationStatus(req: express.Request, res: express.Response, next: CallableFunction) {
  const roomTypes = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED'];

  if (!roomTypes.includes(req.body.status.toUpperCase())) {
    res.status(400).json({ error: 'Invalid reservation status!' });
    return;
  }
  res.locals.status = req.body.status.toUpperCase();

  next();
}
// #endregion

// #region Auth
app.get('/api/v1/auth', passport.authenticate('jwt', { session: false }),
  (req: express.Request, res: express.Response) => {
    res.json(req.user);
  });

app.post('/api/v1/auth', async (req: express.Request, res: express.Response) => {
  if (!req.body.email || !req.body.password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });

  if (!user || user.deletedAt !== null) {
    res.status(401).json({ error: 'Invalid email or password!' });
    return;
  }

  try {
    if (!await argon2.verify(user.password, req.body.password || '')) {
      res.status(401).json({ error: 'Invalid email or password!' });
      return;
    }
  } catch (e) {
    res.status(500).json({ error: 'Internal argon error!' });
  }
  res.status(200).json({
    user,
    accessToken: jwt.sign({}, SECRET, {
      audience: AUDIENCE,
      expiresIn: '1d',
      issuer: ISSUER,
      subject: user.id.toString(),
    }),
  });
});
// #endregion

// #region Users
app.get('/api/v1/users/:userId', passport.authenticate('jwt', { session: false }), parseUser,
  async (req: express.Request, res: express.Response) => {
    const result = await prisma.user.findFirst({
      where: {
        id: res.locals.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (result === null) {
      res.status(404).json({ error: 'User\'s account does not exist!' });
      return;
    }

    res.status(200).json(result);
  });

app.post('/api/v1/users/', verifyNewUser, async (req: express.Request, res: express.Response) => {
  const newUser = await prisma.user.create({
    data: {
      firstName: res.locals.firstName,
      lastName: res.locals.lastName,
      email: res.locals.email,
      password: res.locals.password,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (newUser === null) {
    res.status(500).json({ error: 'User creation failed!' });
  }

  res.status(200).json(newUser);
});

app.patch('/api/v1/users/:userId', passport.authenticate('jwt', { session: false }), parseUser,
  verifyPassword, async (req: express.Request, res: express.Response) => {
    const originalUser = await prisma.user.findUnique({
      where: {
        id: res.locals.userId,
      },
    });

    if (req.body.email !== undefined && await emailInDb(req.body.email, res.locals.userId)) {
      res.status(409).json({ error: `Account with email ${req.body.email} already exists` });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: res.locals.userId,
      },
      data: {
        firstName: (req.body.firstName !== undefined && req.body.firstName !== ''
          ? req.body.firstName : originalUser?.firstName),
        lastName: (req.body.lastName !== undefined && req.body.lastName !== ''
          ? req.body.lastName : originalUser?.lastName),

        email: (req.body.email !== undefined && validateEmail(req.body.email)
          ? req.body.email : originalUser?.email),
        password: (req.body.password !== undefined && validatePassword(req.body.password)
          ? await argon2.hash(req.body.password) : originalUser?.password),

        updatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json(updatedUser);
  });
// #endregion

// #region Rooms
app.get('/api/v1/rooms/', setRoomTypes, setAvailableDates, async (req: express.Request, res: express.Response) => {
  if (req.query.host !== undefined && !Number.isNaN(+req.query.host)) {
    const roomsByHost = await prisma.room.findMany({
      where: {
        hostId: +req.query.host,
        deletedAt: null,
      },
      include: {
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        photos: {
          where: { deletedAt: null },
        },
        location: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json(roomsByHost);
    return;
  }

  if (req.query.city === undefined || req.query.city === '') {
    res.status(400).json({ error: 'Invalid city name!' });
    return;
  }

  if (req.query.guests !== undefined && Number.isNaN(+req.query.guests)) {
    res.status(400).json({ error: 'Invalid guest number!' });
    return;
  }

  res.locals.guests = Number(req.query.guests);
  res.locals.city = req.query.city;

  // cannot use select & include on the same level
  // https://www.prisma.io/docs/reference/api-reference/prisma-client-reference/#select
  const suitableOffers = await prisma.room.findMany({
    where: {
      location: {
        city: res.locals.city,
      },
      available: true,
      beds: { gte: res.locals.guests + 1 },
      type: { in: res.locals.suitableTypes },
      reservations: {
        none: {
          AND: {
            from: { lt: res.locals.dateTo },
            to: { gt: res.locals.dateFrom },
            status: { in: ['ACCEPTED', 'PENDING'] },
          },
        },
      },
      deletedAt: null,
    },
    include: {
      host: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      photos: {
        where: { deletedAt: null },
      },
      location: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.status(200).json(suitableOffers);
});

app.post('/api/v1/rooms/', passport.authenticate('jwt', { session: false }), verifyRoomData,
  async (req: express.Request, res: express.Response) => {
  // user is NOT checked/verified!

    const newRoom = await prisma.room.create({
      data: {
        host: {
          connect: {
            id: (req.user as User).id,
          },
        },
        location: {
          create: {
            street: res.locals.street,
            city: res.locals.city,
            country: res.locals.country,
          },
        },

        name: res.locals.name,
        description: req.body.description,
        beds: res.locals.beds,
        price: res.locals.price,

        type: res.locals.type,
        available: res.locals.available,
      },
    });

    if (newRoom === null) {
      res.status(500).json({ error: 'Room creation failed!' });
      return;
    }

    res.status(200).json(newRoom);
  });

app.put('/api/v1/rooms/:roomId', passport.authenticate('jwt', { session: false }), parseRoom,
  verifyRoomData, async (req: express.Request, res: express.Response) => {
  // note that `new Date()` returns UTC, not our CE(S)T

    const updatedRoom = await prisma.room.update({
      where: {
        id: res.locals.roomId,
      },
      data: {
        location: {
          create: {
            street: res.locals.street,
            city: res.locals.city,
            country: res.locals.country,
          },
        },
        available: res.locals.available,
        name: res.locals.name,
        description: req.body.description,

        beds: res.locals.beds,
        price: res.locals.price,
        type: res.locals.type,

        updatedAt: new Date(),
      },
    });

    if (updatedRoom === null) {
      res.status(500).json({ error: 'Room update failed!' });
      return;
    }

    res.status(200).json(updatedRoom);
  });

app.get('/api/v1/rooms/:roomId', parseRoom, async (req: express.Request, res: express.Response) => {
  const result = await prisma.room.findUnique({
    where: { id: res.locals.roomId },
    include: {
      host: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      photos: {
        where: { deletedAt: null },
        select: {
          id: true,
          path: true,
          isMain: true,
        },
        orderBy: {
          uploadedAt: 'desc',
        },
      },
      location: true,
    },
  });

  if (result === null || result.deletedAt !== null) {
    res.status(404).json({ error: 'Room does not exist.' });
    return;
  }

  res.status(200).json(result);
});

app.delete('/api/v1/rooms/:roomId', passport.authenticate('jwt', { session: false }), parseRoom,
  async (req: express.Request, res: express.Response) => {
    const result = await prisma.room.update({
      where: {
        id: res.locals.roomId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result === null) {
      res.status(400).json({ error: 'Room does not exist.' });
      return;
    }

    res.sendStatus(200);
  });
// #endregion

// #region Photos
app.get('/api/v1/rooms/:roomId/photos/', parseRoom,
  async (req: express.Request, res: express.Response) => {
    const result = await prisma.roomPhoto.findMany({
      where: {
        roomId: res.locals.roomId,
        deletedAt: null,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    res.status(200).json(result);
  });

app.delete('/api/v1/rooms/:roomId/photos/:photoId', passport.authenticate('jwt', { session: false }),
  parseRoom, photoInDb, async (req: express.Request, res: express.Response) => {
    const belongsToRoom = await prisma.roomPhoto.findFirst({
      where: {
        roomId: res.locals.roomId,
        id: res.locals.photoId,
      },
    }) !== null;

    if (!belongsToRoom) {
      res.status(400).json({ error: 'Photo you want to delete does not belong to the room!' });
      return;
    }

    const result = await prisma.roomPhoto.update({
      where: {
        id: res.locals.photoId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (!result) {
      res.status(500).json({ error: 'Could not delete the photo.' });
      return;
    }

    res.sendStatus(200);
  });

app.post('/api/v1/rooms/:roomId/photos/', passport.authenticate('jwt', { session: false }), parseRoom,
  fileUpload({
    createParentPath: true,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
    abortOnLimit: true,
  }), async (req: express.Request, res: express.Response) => {
    const photoFile = req.files?.photo as fileUpload.UploadedFile | undefined;
    if (!photoFile || (photoFile.mimetype !== 'image/png' && photoFile.mimetype !== 'image/jpg'
        && photoFile.mimetype !== 'image/jpeg')) {
      res.status(400).json({ error: 'One image is required' });
      return;
    }

    const extension = photoFile.mimetype.split('/').pop();
    const filename = `${uuidv4()}.${extension}`;
    photoFile.mv(`./public/photos/${filename}`);

    res.json(await prisma.roomPhoto.create({
      data: {
        path: filename,
        room: {
          connect: {
            id: +req.params.roomId,
          },
        },
      },
      select: {
        id: true,
        isMain: true,
        path: true,
        uploadedAt: true,
      },
    }));
  });

app.put('/api/v1/rooms/:roomId/photos/:photoId', passport.authenticate('jwt', { session: false }),
  parseRoom, async (req: express.Request, res: express.Response) => {
    if (Number.isNaN(+req.params.photoId)) {
      res.status(400).json({ error: 'Invalid photo ID!' });
      return;
    }
    res.locals.photoId = +req.params.photoId;

    const mainPhoto = await prisma.roomPhoto.findFirst({
      where: {
        roomId: res.locals.roomId,
        id: res.locals.photoId,
        deletedAt: null,
      },
    });

    if (mainPhoto === null) {
      res.status(400).json({ error: 'Photo does not belong to the room!' });
      return;
    }

    const firstUpdate = await prisma.roomPhoto.updateMany({
      where: {
        roomId: res.locals.roomId,
      },
      data: {
        isMain: false,
      },
    });

    const secondUpdate = await prisma.roomPhoto.update({
      where: {
        id: res.locals.photoId,
      },
      data: {
        isMain: true,
      },
    });

    if (firstUpdate === null || secondUpdate === null) {
      res.status(500).json({ error: 'Internal error!' });
      return;
    }

    res.status(200).json(secondUpdate);
  });
// #endregion

// #region Reservations
app.get('/api/v1/reservations/', passport.authenticate('jwt', { session: false }),
  async (req: express.Request, res: express.Response) => {
    const where: Prisma.ReservationWhereInput = {};

    if (req.query.roomId !== undefined && !Number.isNaN(+req.query.roomId)) {
      where.roomId = +req.query.roomId;
    } else if (req.query.guestId !== undefined && !Number.isNaN(+req.query.guestId)) {
      where.guestId = +req.query.guestId;
    }

    if (where.roomId === undefined && where.guestId === undefined) {
      res.status(400).json({ error: 'No valid room ID / guest ID specified!' });
      return;
    }

    if (req.query.all === undefined) {
      where.to = { gte: new Date() };
    }

    const result = await prisma.reservation.findMany({
      where,
      include: {
        room: {
          include: {
            host: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            location: true,
          },
        },
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json(result);
  });

app.delete('/api/v1/reservations/:reservationId/', passport.authenticate('jwt', { session: false }),
  reservationExists, async (req: express.Request, res: express.Response) => {
    const result = await prisma.reservation.update({
      where: {
        id: res.locals.reservationId,
      },
      data: {
        status: 'CANCELED',
      },
    });

    if (result === null) {
      res.status(500).json({ error: 'Internal error!' });
      return;
    }

    res.sendStatus(200);
  });

app.post('/api/v1/reservations/', passport.authenticate('jwt', { session: false }), validateDates,
  async (req: express.Request, res: express.Response) => {
    if (req.body.roomId === undefined || Number.isNaN(+req.body.roomId)) {
      res.status(400).json({ error: 'Invalid guestId parameter!' });
      return;
    }

    res.locals.roomId = +req.body.roomId;
    res.locals.guestId = (req.user as User).id;
    res.locals.dateFrom = new Date(req.body.dateFrom);
    res.locals.dateTo = new Date(req.body.dateTo);

    const isRoomValid = await prisma.room.findUnique({
      where: { id: res.locals.roomId },
      include: {
        reservations: {
          where: {
            AND: {
              from: { lt: res.locals.dateTo },
              to: { gt: res.locals.dateFrom },
              status: { in: ['ACCEPTED', 'PENDING'] },
            },
          },
        },
      },
    });

    const isUserValid = await prisma.user.findFirst({
      where: { id: res.locals.guestId },
    });

    if (isRoomValid === null || isUserValid === null) {
      res.status(400).json({ error: 'Invalid room or guest!' });
      return;
    }

    if (isRoomValid.reservations.length) {
      res.status(400).json({ error: 'The room is already booked in the given time interval' });
      return;
    }

    const result = await prisma.reservation.create({
      data: {
        guestId: res.locals.guestId,
        roomId: res.locals.roomId,
        from: res.locals.dateFrom,
        to: res.locals.dateTo,
      },
    });

    res.status(200).json(result);
  });

app.put('/api/v1/reservations/:reservationId/', passport.authenticate('jwt', { session: false }), reservationExists,
  setReservationStatus, async (req: express.Request, res: express.Response) => {
    const result = await prisma.reservation.update({
      where: {
        id: res.locals.reservationId,
      },
      data: {
        status: res.locals.status,
      },
    });

    if (result === null) {
      res.status(500).json({ error: 'Internal error!' });
      return;
    }

    res.status(200).json(result);
  });

// #endregion
app.listen(PORT, () => console.log(`Listening on port ${PORT}...`));
