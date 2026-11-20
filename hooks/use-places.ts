'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { getAllPlaces } from '@/lib/db'

export function usePlaces() {
  const { data, mutate, isLoading } = useSWR('indexeddb:places', getAllPlaces, {
    revalidateOnFocus: false,
  })
  const refresh = useCallback(() => {
    void mutate()
  }, [mutate])
  return { places: data ?? [], refresh, isLoading }
}
