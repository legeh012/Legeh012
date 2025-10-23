import { z } from 'zod';
import {
  generateScene,
  generateConfessionOverlay,
  composeFinalClip,
} from './modules/videoEngine.js';
import {
  fetchCastSchema,
  fetchEpisodeData,
} from './modules/storyForge.js';

// ✅ Input validation
const inputSchema = z.object({
  castId: z.string().min(1),
  episodeId: z.string().min(1),
  showId: z.string().min(1),
});

export async function generateCinematicClip({ castId, episodeId, showId }) {
  inputSchema.parse({ castId, episodeId, showId });

  const castData = await fetchCastSchema(castId, showId);
  const episodeData = await fetchEpisodeData(episodeId, showId);

  const baseScene = await generateScene(castData, episodeData);
  const confessionOverlay = await generateConfessionOverlay(castData.confessional);

  const finalClip = await composeFinalClip(baseScene, confessionOverlay, {
    style: 'photorealistic',
    motion: 'cinematic',
    soundtrack: castData.soundtrack,
  });

  return finalClip;
}
