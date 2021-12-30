/* eslint-disable */

const locations = JSON.parse(document.getElementById('map').dataset.locations);

console.log(locations[0].coordinates);

mapboxgl.accessToken =
  'pk.eyJ1IjoiYWxleG1uZXQiLCJhIjoiY2trcW5qbWc4MDMzdzJwcDY0bTRiamNoaSJ9.qgsYHjngiVOt9keWynHojQ';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  style: 'mapbox://styles/alexmnet/ckxs8u6s8tasc15luke27wiak', // style URL
  scrollZoom: false,
  center: [-74.5, 40], // starting position [lng, lat]
  zoom: 9 // starting zoom
});

const bounds = new mapboxgl.LngLatBounds();

locations.forEach(loc => {
  //add marker
  const el = document.createElement('div');
  el.className = 'marker';

  new mapboxgl.Marker({
    element: el,
    anchor: 'bottom'
  })
    .setLngLat(loc.coordinates)
    .addTo(map);

  new mapboxgl.Popup({
    offset: 30
  })
    .setLngLat(loc.coordinates)
    .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
    .addTo(map);

  bounds.extend(loc.coordinates);
});

map.fitBounds(bounds, {
  padding: {
    top: 200,
    bottom: 150,
    left: 200,
    right: 200
  }
});
