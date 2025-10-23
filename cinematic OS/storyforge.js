const showRegistry = {
  SistersOfTheDiaspora: {
    castSchemas: {
      ayaan01: {
        name: 'Ayaan',
        confessional: { text: 'I never said wallahi...', style: 'chaos-native' },
        soundtrack: 'somali-diaspora-beat-01.mp3',
      },
    },
    episodeScripts: {
      ep3: {
        setting: 'Minneapolis rooftop',
        arc: 'Say Wallahi Edition',
      },
    },
  },
  SayWallahiEdition: {
    castSchemas: {
      max01: {
        name: 'Max',
        confessional: { text: 'I said wallahi... but did I mean it?', style: 'satirical' },
        soundtrack: 'wallahi-beat-02.mp3',
      },
    },
    episodeScripts: {
      ep7: {
        setting: 'Texas garage',
        arc: 'Wallahi Remix',
      },
    },
  },
};

export async function fetchCastSchema(castId, showId) {
  const show = showRegistry[showId];
  if (!show) throw new Error(`Unknown showId: ${showId}`);

  const cast = show.castSchemas[castId];
  if (!cast) throw new Error(`Cast ID ${castId} not found in ${showId}`);

  return cast;
}

export async function fetchEpisodeData(episodeId, showId) {
  const show = showRegistry[showId];
  if (!show) throw new Error(`Unknown showId: ${showId}`);

  const episode = show.episodeScripts[episodeId];
  if (!episode) throw new Error(`Episode ID ${episodeId} not found in ${showId}`);

  return episode;
}
