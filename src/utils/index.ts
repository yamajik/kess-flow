export async function delay(ms: number): Promise<void> {
  if (ms > 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function group(array: any[], chunk: number): any[][] {
  const result = [];
  for (let i = 0; i < array.length; i += chunk) {
    result.push(array.slice(i, i + chunk));
  }
  return result;
}

export function flat(array: any[][]): any[] {
  const result = [];
  array.forEach(a => result.push(...a));
  return result;
}
