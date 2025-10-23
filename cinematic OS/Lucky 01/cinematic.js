import { fetchLuckyTrack } from './modules/sunoFetcher.js';

const sunoMeta = await fetchLuckyTrack(castData.sunoTrackId);

const finalClip = await composeFinalClip(baseScene, confessionOverlay, {
  style: 'photorealistic',
  motion: 'cinematic',
  soundtrack: sunoMeta.audioUrl,
  artist: sunoMeta.artist,
  album: sunoMeta.album,
});
