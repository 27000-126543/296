import { create } from 'zustand'
import type { CarbonData } from '../types'
import { generateCarbonData } from '../utils/mockData'

interface CarbonState {
  data: CarbonData[]
  refresh: () => void
}

export const useCarbonStore = create<CarbonState>((set) => ({
  data: generateCarbonData(),
  refresh: () => {
    set({ data: generateCarbonData() })
  },
}))
