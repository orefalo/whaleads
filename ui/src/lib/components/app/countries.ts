export function countryName(code: string) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code } catch { return code }
}

export function timezoneList(current: string): string[] {
  let z: string[] = []
  try { z = Intl.supportedValuesOf('timeZone') } catch { /* older engines */ }
  return z.includes(current) || !current ? z : [current, ...z]
}
