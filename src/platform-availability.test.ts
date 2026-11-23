import { describe, expect, it } from 'vitest'
import { parsePlatformResponse, readPlatformFlags } from '../lib/platform-availability'

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

  it('normalizes common platform names and fills omitted platforms as unconfirmed', () => {
    const flags = readPlatformFlags({
      deliveryPlatforms: { Talabat: 'available', Keeta: 'no' },
      discounts: { 'Urban Point': 'yes' },
    })
    expect(flags).toMatchObject({
      deliveryPlatforms: { talabat: true, snoonu: false, rafeek: false, keeta: false },
      discountPlatforms: { urban_point: true, mybook: false, entertainer: false },
      missingCount: 4,
    })
  })
})
