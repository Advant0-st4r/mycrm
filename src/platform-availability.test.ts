import { describe, expect, it } from 'vitest'
import { buildVerificationPrompt, parsePlatformResponse, readPlatformFlags } from '../lib/platform-availability'

describe('platform response parsing', () => {
  it('extracts JSON from a fenced reply with surrounding explanation', () => {
    const response = parsePlatformResponse(`Here are the results:\n\n\`\`\`json\n[{"restaurantName":"Cafe One","deliveryPlatforms":{"talabat":true}}]\n\`\`\`\nHope that helps.`)
    expect(response).toHaveLength(1)
    expect(response[0]).toMatchObject({ restaurantName: 'Cafe One' })
  })

  it('extracts a JSON list from plain surrounding text', () => {
    const response = parsePlatformResponse('Results: [{"name":"Cafe Two","deliveryPlatforms":{"snoonu":true}}] Done.')
    expect(response).toHaveLength(1)
  })

  it('accepts results wrappers and a single restaurant object', () => {
    expect(parsePlatformResponse('{"results":[{"name":"Cafe Three"}]}')).toHaveLength(1)
    expect(parsePlatformResponse('{"name":"Cafe Four"}')).toHaveLength(1)
  })

  it('builds an individual delivery listing search prompt for each restaurant', () => {
    const prompt = buildVerificationPrompt([
      { id: 'p1', name_en: 'Abo Shariha', name_ar: 'أبو شريحة' },
      { id: 'p2', name_en: 'Cafe Two' },
    ])
    expect(prompt).toContain('Search each restaurant separately')
    expect(prompt).toContain('"Abo Shariha"')
    expect(prompt).toContain('site:talabat.com OR site:snoonu.com OR site:keeta.com OR site:rafeeq.com OR site:ninja.sa')
    expect(prompt).toContain('"Cafe Two"')
    expect(prompt).toContain('"ninja":false')
  })

  it('normalizes common platform names and fills omitted platforms as unconfirmed', () => {
    const flags = readPlatformFlags({
      deliveryPlatforms: { Talabat: 'available', Keeta: 'no', Ninja: 'yes' },
      discounts: { 'Urban Point': 'yes' },
    })
    expect(flags).toMatchObject({
      deliveryPlatforms: { talabat: true, snoonu: false, rafeek: false, keeta: false, ninja: true },
      discountPlatforms: { urban_point: true, mybook: false, entertainer: false },
      missingCount: 4,
    })
  })
})
