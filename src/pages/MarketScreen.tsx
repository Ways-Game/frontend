import React, { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown, X } from "lucide-react"
import { useTelegram } from "@/hooks/useTelegram"
import { api } from "@/services/api"
import type { UserProfile, Gift } from "@/types"
import refBack from "@assets/ref_back.png"
import { starIcon, refIcon } from "@/assets/icons"

export function MarketScreen() {
  const { user, webApp, loadUserProfile, showAlert } = useTelegram()

  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'Low to High' | 'High to Low'>('Low to High')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const [gifts, setGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [buyingId, setBuyingId] = useState<number | null>(null)

  // Load user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return
      try {
        const profile = await api.getUserProfile(user.id)
        setUserProfile(profile)
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
      }
    }

    fetchUserProfile()
  }, [user?.id])

  // Load gifts
  useEffect(() => {
    const fetchGifts = async () => {
      try {
        setLoading(true)
        const data = await api.getGifts()
        setGifts(data)
      } catch (e) {
        console.error('Failed to load gifts', e)
      } finally {
        setLoading(false)
      }
    }
    fetchGifts()
  }, [])

  const filteredGifts = useMemo(() => {
    const query = (searchQuery || '').toLowerCase().trim()
    const base = gifts || []
    const filtered = base.filter((g) => {
      if (!query) return true
      const title = (g.title || '').toLowerCase()
      const priceStr = String(g.price || '').toLowerCase()
      return title.includes(query) || priceStr.includes(query)
    })

    const sorted = [...filtered]
    if (sortOrder === 'Low to High') sorted.sort((a,b) => a.price - b.price)
    if (sortOrder === 'High to Low') sorted.sort((a,b) => b.price - a.price)
    return sorted
  }, [gifts, searchQuery, sortOrder])

  const handleBuy = async (gift: Gift) => {
    if (!user?.id) {
      showAlert('Please open via Telegram')
      return
    }

    try {
      setBuyingId(gift.available_gift_id)
      const init_data = webApp?.initData || ''
      const res = await api.buyGift({
        user_id: user.id,
        gift_id: gift.gift_id,
        count: 1,
        init_data,
      })
      showAlert(`Order created! Wait for your gift a little while`)
      await loadUserProfile()
    } catch (e: any) {
      console.error('Buy gift error', e)
      showAlert(e?.message || 'Failed to buy gift')
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col gap-2.5 overflow-hidden pb-20">
      <div className="flex-1 p-2.5 flex flex-col gap-2.5 overflow-hidden">
        {/* Top Controls */}
        <div className="self-stretch inline-flex justify-between items-start">
          <div className="flex justify-start items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 bg-zinc-800 rounded-[20px] flex justify-center items-center gap-2 overflow-hidden"
              onClick={() => setSortOrder(prev => prev === 'Low to High' ? 'High to Low' : 'Low to High')}
              title={`Sort: ${sortOrder}`}
            >
              <ArrowUpDown className="w-4 h-4 text-neutral-500 rotate-90" />
              <span className="text-xs text-neutral-400">{sortOrder}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Balance Display */}
            <div className="h-8 px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-1.5">
              <img src={starIcon} className="w-4 h-4" alt="star" />
              <span className="text-white text-sm font-semibold">{userProfile?.balance ?? 0}</span>
            </div>
            <button className="h-8 px-3 py-2 bg-[#007AFF] rounded-[20px] flex items-center gap-1.5">
              <img src={refIcon} className="w-5 h-5" alt="ref" />
              <span className="text-white text-base font-semibold">Connect</span>
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div 
          className="px-5 py-5 bg-gradient-to-b from-fuchsia-500 to-indigo-400 rounded-[20px] flex flex-col gap-5 relative overflow-hidden"
          style={{
            backgroundImage: `url(${refBack})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="text-neutral-50 text-3xl font-bold w-[80%] ">
            Post videos and earn money
          </div>
          <div className="flex ">
            <button 
              className="h-10 px-3 py-2 bg-white rounded-[20px]"
            >
              <span className="text-black text-base font-semibold">Earn money</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="self-stretch flex flex-col justify-start items-start">
          <div className="self-stretch h-12 px-4 bg-zinc-800 rounded-xl inline-flex justify-start items-center gap-3 overflow-hidden">
            <div className="flex-1 relative flex justify-start items-center gap-1 flex-wrap content-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-white text-base font-normal leading-snug outline-none"
                placeholder="Search gifts"
              />
            </div>
            {searchQuery ? (
              <X 
                className="w-6 h-6 text-neutral-400 opacity-50 cursor-pointer" 
                onClick={() => setSearchQuery('')}
              />
            ) : (
              <Search className="w-6 h-6 text-neutral-400 opacity-50" />
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="self-stretch flex-1 relative inline-flex justify-center items-start gap-2.5 flex-wrap content-start overflow-y-auto">
          {loading && (
            <div className="w-full text-center text-neutral-400 py-4">Loading...</div>
          )}
          {!loading && filteredGifts.map((gift) => (
            <div key={gift.available_gift_id} style={{width: "calc(100% / 3 - 8px)"}} className=" h-34 p-2.5 bg-stone-950 rounded-xl border border-[#5F5F5F] backdrop-blur-sm inline-flex flex-col justify-end items-center gap-2 overflow-hidden">
              <div className="flex flex-col justify-start items-center gap-0.5">
                <span className="text-neutral-50 text-xs truncate max-w-full" title={gift.title}>{gift.title}</span>
                <span className="text-neutral-50/50 text-[10px]">Gift</span>
              </div>
              <img className="self-stretch flex-1 rounded-xl object-cover" src={gift.url} alt={gift.title} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <button
                className="self-stretch px-[26px] py-[8px] bg-zinc-800 rounded-[20px] inline-flex justify-center items-center gap-2 overflow-hidden disabled:opacity-50"
                onClick={() => handleBuy(gift)}
                disabled={buyingId === gift.available_gift_id}
              >
                <div className="flex justify-start items-center gap-[4px]">
                  <span className="text-neutral-50 text-sm leading-snug text-[20px]">{gift.price}</span>
                  <img src={starIcon} className="w-4 h-[18px]" alt="star" />
                </div>
              </button>
            </div>
          ))}
          {!loading && filteredGifts.length === 0 && (
            <div className="w-full text-center text-neutral-400 py-4">No gifts found</div>
          )}
        </div>
      </div>
    </div>
  )
}