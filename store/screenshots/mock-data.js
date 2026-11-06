// Made-up songs, artists and playlists for the store screenshots. Artwork is
// a generated gradient tile, so no real album art or artist appears.

function art(hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${hue + 40},65%,42%)"/>
    </linearGradient></defs>
    <rect width="60" height="60" fill="url(#g)"/>
    <circle cx="30" cy="30" r="13" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
    <circle cx="30" cy="30" r="3" fill="rgba(255,255,255,.75)"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const MOCK = {
  queue: [
    { title: "Paper Lanterns", artist: "The Quiet Harbors", album: "Low Tide", hue: 200 },
    { title: "Northbound", artist: "Mira Castell", album: "Atlas", hue: 30 },
    { title: "Glass Orchard", artist: "Lumen Avenue", album: "Midnight Fields", hue: 265 },
    { title: "Static Hearts", artist: "Neon Saltwater", album: "Signal", hue: 330 },
    { title: "Slow Machines", artist: "Ada Wren", album: "Copper", hue: 150 },
    { title: "Satellite Summer", artist: "The Quiet Harbors", album: "Low Tide", hue: 200 },
    { title: "Wildflower Radio", artist: "June Okafor", album: "Frequencies", hue: 45 },
    { title: "Open Roads", artist: "Kestrel & Fox", album: "Miles", hue: 100 },
    { title: "Blue Hour", artist: "Lumen Avenue", album: "Midnight Fields", hue: 265 },
    { title: "Echo Park", artist: "Mira Castell", album: "Atlas", hue: 30 },
    { title: "Lighthouse", artist: "Ada Wren", album: "Copper", hue: 150 },
  ],
  playlist: [
    { title: "City Lights Fade", artist: "Neon Saltwater", hue: 330 },
    { title: "Glass Orchard", artist: "Lumen Avenue", hue: 265 },
    { title: "Northbound", artist: "Mira Castell", hue: 30 },
    { title: "Highway Hum", artist: "Kestrel & Fox", hue: 100 },
    { title: "Paper Lanterns", artist: "The Quiet Harbors", hue: 200 },
    { title: "After Hours", artist: "June Okafor", hue: 45 },
    { title: "Slow Machines", artist: "Ada Wren", hue: 150 },
    { title: "Midnight Fields", artist: "Lumen Avenue", hue: 265 },
    { title: "Tail Lights", artist: "Neon Saltwater", hue: 330 },
  ],
  home: [
    {
      title: "Quick picks",
      items: [
        { title: "Static Hearts", sub: "Song • Neon Saltwater", hue: 330 },
        { title: "Wildflower Radio", sub: "Song • June Okafor", hue: 45 },
        { title: "Open Roads", sub: "Song • Kestrel & Fox", hue: 100 },
      ],
    },
    {
      title: "Mixed for you",
      items: [
        { title: "My Supermix", sub: "Mira Castell, Ada Wren and more", hue: 280 },
        { title: "Focus Mix", sub: "Lumen Avenue, The Quiet Harbors", hue: 190 },
        { title: "Evening Mix", sub: "June Okafor, Neon Saltwater", hue: 15 },
      ],
    },
  ],
};
