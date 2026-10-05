import { describe, it, expect } from 'vitest'
import { deviceLabel } from '@/lib/devices'

const UA = {
  iphoneSafari:  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  samsung:       'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36',
  windowsEdge:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
  macFirefox:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0',
  macSafari:     'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
}

describe('deviceLabel', () => {
  it('names browser and device, checking the look-alikes first', () => {
    expect(deviceLabel(UA.iphoneSafari, 'web')).toBe('Safari on iPhone')
    expect(deviceLabel(UA.iphoneChrome, 'web')).toBe('Chrome on iPhone')
    expect(deviceLabel(UA.androidChrome, 'web')).toBe('Chrome on Android')
    expect(deviceLabel(UA.samsung, 'web')).toBe('Samsung Internet on Android')
    expect(deviceLabel(UA.windowsEdge, 'web')).toBe('Edge on Windows')
    expect(deviceLabel(UA.macFirefox, 'web')).toBe('Firefox on Mac')
    expect(deviceLabel(UA.macSafari, 'web')).toBe('Safari on Mac')
  })

  it('labels app sessions as the app', () => {
    expect(deviceLabel('Proviso/1.0 (iPhone; iOS 18.0)', 'app')).toBe('Proviso app on iPhone')
    expect(deviceLabel(null, 'app')).toBe('Proviso app')
  })

  it('falls back when nothing is recognisable', () => {
    expect(deviceLabel(null, 'web')).toBe('Unknown device')
    expect(deviceLabel('curl/8.0', 'web')).toBe('Unknown device')
  })
})
