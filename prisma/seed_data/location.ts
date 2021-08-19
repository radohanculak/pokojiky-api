const locations = [
  {
    country: 'Slovakia',
    city: 'Košice',
    street: 'Humenská 5',
  },
  {
    country: 'Slovakia',
    city: 'Košice',
    street: 'Poštová 9',
  },
  {
    country: 'Slovakia',
    city: 'Košice',
    street: 'Šoltésovej 5',
  },
  {
    country: 'Czech Republic',
    city: 'Brno',
    street: 'Merhautova 14',
  },
  {
    country: 'Czech Republic',
    city: 'Brno',
    street: 'Pokorova 15',
  },
  {
    country: 'Czech Republic',
    city: 'Brno',
    street: 'Roosveltova 11',
  },
  {
    country: 'Slovakia',
    city: 'Vranov nad Topľou',
    street: 'Dubník 11',
  },
  {
    country: 'Slovakia',
    city: 'Vranov nad Topľou',
    street: 'B. Němcovej 8',
  },
];

const location = () => locations[Math.floor(Math.random() * locations.length)];

export default location;
