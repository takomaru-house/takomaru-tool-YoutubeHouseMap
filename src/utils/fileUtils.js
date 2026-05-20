const fs = require('fs').promises;

const writeJsonAtomic = async (filePath, data) => {
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
};

module.exports = { writeJsonAtomic };
