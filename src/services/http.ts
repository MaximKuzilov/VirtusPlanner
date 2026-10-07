export async function fetchJSON(url: string, options: RequestInit = {}, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`Сервис недоступен (HTTP ${response.status}). Попробуйте позже.`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Сервис не ответил вовремя. Попробуйте ещё раз.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
