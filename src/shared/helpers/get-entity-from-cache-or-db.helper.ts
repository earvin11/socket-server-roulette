export const getEntityFromCacheOrDb = async <T>(
  cacheGetter: () => Promise<string | null>,
  dbGetter: () => Promise<T | null>,
  setRedis: (entity: T) => Promise<string>,
): Promise<T | null> => {
  const cacheData = await cacheGetter();
  // console.log({ cacheData })
  if (!cacheData) {
    const dbData = await dbGetter();
    if (!dbData) return null;

    await setRedis(dbData);
    return dbData;
  }
  return JSON.parse(cacheData);
};
