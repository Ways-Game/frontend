import React, { useState } from "react"
import { Search, Filter, ArrowUpDown, X } from "lucide-react"

export function MarketScreen() {
  const [searchQuery, setSearchQuery] = useState('Snoo')
  const [sortOrder, setSortOrder] = useState('Low to High')

  const products = Array(10).fill(null).map((_, i) => ({
    id: i + 1,
    name: 'Snoop Dogg',
    category: 'Random',
    price: 200,
    image: '/src/assets/market_gift.png'
  }))

  return (
    <div className="min-h-screen bg-black flex flex-col gap-2.5 overflow-hidden pb-20">
      <div className="flex-1 p-2.5 flex flex-col gap-2.5 overflow-hidden">
        {/* Top Controls */}
        <div className="self-stretch inline-flex justify-between items-start">
          <div className="flex justify-start items-center gap-2">
            <div className="px-2 py-2 bg-zinc-800 rounded-[20px] flex justify-center items-center gap-2 overflow-hidden">
              <Filter className="w-4 h-4 text-stone-300" />
            </div>
            <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex justify-center items-center gap-2 overflow-hidden">
              <ArrowUpDown className="w-4 h-4 text-neutral-500 rotate-90" />
              <span className="text-neutral-50 text-sm leading-snug">Low to High</span>
            </div>
          </div>
          <button className="h-8 px-3 py-2 bg-[#007AFF] rounded-[20px] flex items-center gap-1.5">
            <img src="/src/assets/icons/ref.svg" className="w-5 h-5" alt="ref" />
            <span className="text-white text-base font-semibold">Connect</span>
          </button>
        </div>

        {/* Hero Banner */}
        <div 
          className="px-5 py-5 bg-gradient-to-b from-fuchsia-500 to-indigo-400 rounded-[20px] flex flex-col gap-5 relative overflow-hidden h-[154px]"
          style={{
            backgroundImage: 'url(/src/assets/ref_back.png)',
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
        <div className="self-stretch flex-1 relative inline-flex justify-center items-start gap-[8px] flex-wrap content-start overflow-y-auto">
          {products.map((product) => (
            <div key={product.id} className="w-[calc(100%/3-8px)] h-34 p-2.5 bg-stone-950 rounded-xl border border-[#5F5F5F] backdrop-blur-sm inline-flex flex-col justify-end items-center gap-2 overflow-hidden">
              <div className="flex flex-col justify-start items-center gap-0.5">
                <span className="text-neutral-50 text-xs">{product.name}</span>
                <span className="text-neutral-50/50 text-[10px]">{product.category}</span>
              </div>
              <img className="self-stretch flex-1 rounded-xl object-cover" src={product.image} alt={product.name} />
              <div className="self-stretch px-[26px] py-[8px] bg-zinc-800 rounded-[20px] inline-flex justify-center items-center gap-2 overflow-hidden">
                <div className="flex justify-start items-center gap-[4px]">
                  <span className="text-neutral-50 text-sm leading-snug text-[20px]">{product.price}</span>
                  <img src="/src/assets/icons/star.svg" className="w-4 h-[18px]" alt="star" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}