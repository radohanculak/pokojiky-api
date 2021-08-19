# __Pokojíky REST API__


&nbsp;
> ## Users

### `POST` /users/ Create a new user
Request: name, email, password\
Response: id, name, email, createdAt, updatedAt

### `GET` /users/{userId} Find the user by id
Response: id, name, email, createdAt, updatedAt

### `PATCH` /users/{userId} Update the user partially
Request: name (optional), email (optional), password (optional), passwordVerify\
`passwordVerify` is always required, verifies the old password
other fields updated set if not undefined\
Response: id, name, email, createdAt, updatedAt

- *Sample response:*
```js
{
  "id": 11,
  "firstName": "Jiri",
  "lastName": "Kara",
  "email": "rico@attack.me",
  "createdAt": "2021-06-27T15:38:47.424Z",
  "updatedAt": "2021-06-27T16:04:59.317Z"
}
```


&nbsp;
> ## Rooms

### `GET` /rooms/ List rooms
Query: city, dateFrom, dateTo, guests[number], type[enum(privateRoom, sharedRooom, wholePlace)] (optional)\
Lists all rooms in the `city` that are
- set as available
- not reserved in the given time frame
- `guests` + 1 <= `beds`

Response: array of all fileds except available (always true) and description (too long), include host{id, name}, mainPhoto (photo from RoomPhoto, with `mainPhoto == true`){id, path, createdAt, updatedAt}

### `POST` /room/ Create a new room
Request: name, street, city, country, description, available, price, beds, type[enum(privateRoom, sharedRooom, wholePlace)]
set hostId from the current user

Response: all fields

### `GET` /rooms/{roomId} Find room by id
Response: all fields, include host{id, name}, photos{id, path, mainPhoto}

### `PUT` /rooms/{roomId} Update the room fully
Request: name, street, city, country, description, available, price, beds, type[enum(privateRoom, sharedRooom, wholePlace)]

Response: all fields

### `DELETE` /rooms/{roomId} Delete the room by id
set deletedAt to current timestamp

Response: <empty>


&nbsp;
> ## RoomPhotos

### `GET` /rooms/{roomId}/photos/ List photos for room
Response: array of all fields

### `POST` /rooms/{roomId}/photos/
Request: image

save the image and save the path in the database, set mainPhoto to false, if there is another mainPhoto
Response: all fields

### `PUT` /rooms/{roomId}/photos/{photoId}
Request: isMain[bool] (has to be true)\
set the photo as mainPhoto and unsets all other

Response: new main photo

### `DELETE` /rooms/{roomId}/photos/{photoId}
set deletedAt to current timestamp\

Response: <empty>


&nbsp;
> ## Reservations

### `GET` /reservations/ List reservations for room
Query: guestId XOR roomId

- *Sample response:*
```js
[
  {
    "id": 2,
    "guestId": 4,
    "roomId": 1,
    "createdAt": "2021-07-17T09:50:45.679Z",
    "from": "2021-07-17T23:17:13.205Z",
    "to": "2021-10-12T03:39:59.534Z",
    "status": "PENDING",
    "room": {
      "host": {
        "id": 1,
        "firstName": "Jeremie",
        "lastName": "Stroman",
        "email": "first@mail.com"
      }
    },
    "guest": {
      "id": 4,
      "firstName": "Cheyenne",
      "lastName": "Sawayn",
      "email": "fourth@mail.com"
    }
  }
]
```

### `POST` /reservations/ Submit new reservation
Request body: roomId, userId(customer), dateFrom, dateTo, guests

- *Sample response:*
```js
{
  "id": 27,
  "guestId": 2,
  "roomId": 4,
  "createdAt": "2021-07-14T13:59:15.818Z",
  "from": "2021-11-14T00:00:00.000Z",
  "to": "2021-12-11T00:00:00.000Z",
  "status": "PENDING"
}
```


### `DELETE` /reservations/{reservationId} Cancel the reservation

Response: <empty>



### `PUT` /reservations/{reservationId} Change reservation status
Body: RerservationStatus

- *Sample response:*
```js
{
  
}
```
