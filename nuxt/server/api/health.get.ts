export default defineEventHandler(async (event) => {
  const checkService = async (moduleName: string): Promise<string> => {
    try {
      await import(moduleName);
      return 'available';
    } catch (error) {
      console.error(`Error checking ${moduleName}:`, error);
      return 'unavailable';
    }
  };

  const services = {
    puppeteer: await checkService('puppeteer'),
    axe: await checkService('axe-core'),
    pa11y: await checkService('pa11y')
  };

  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    services
  };
});