const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const PUBLISHED_AT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DURATION_REGEX = /^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/;

const validateVideoId = (videoId) => {
  if (typeof videoId !== 'string') return false;
  return VIDEO_ID_REGEX.test(videoId);
};

const validatePublishedAt = (dateString) => {
  if (typeof dateString !== 'string') return false;
  if (!PUBLISHED_AT_REGEX.test(dateString)) return false;
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const validateDuration = (duration) => {
  if (typeof duration !== 'string') return false;
  if (duration === 'PT') return false;
  return DURATION_REGEX.test(duration);
};

module.exports = { validateVideoId, validatePublishedAt, validateDuration };
