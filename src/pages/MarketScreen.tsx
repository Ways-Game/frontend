import React, { useState } from "react"
import { Search, Filter, ArrowUpDown } from "lucide-react"

export function MarketScreen() {
  const [searchQuery, setSearchQuery] = useState('Snoo')
  const [sortOrder, setSortOrder] = useState('Low to High')

  const products = Array(10).fill(null).map((_, i) => ({
    id: i + 1,
    name: 'Snoop Dogg',
    category: 'Random',
    price: 200,
    image: 'https://placehold.co/96x96'
  }))

  return (
    <div className="w-96 h-[746px] bg-black inline-flex flex-col justify-end items-start overflow-hidden">
      <div className="self-stretch flex-1 px-2.5 pt-2.5 flex flex-col justify-end items-start gap-2.5 overflow-hidden">
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
          <button className="h-8 px-3 py-2 bg-blue-600 rounded-[20px] flex justify-center items-center gap-1.5 overflow-hidden">
            <div className="w-5 h-5 text-white">🔗</div>
            <span className="text-white text-base font-semibold">Connect</span>
          </button>
        </div>

        {/* Carousel */}
        <div className="self-stretch pb-5 inline-flex justify-center items-center gap-[5px] overflow-x-auto">
          {[1, 2, 3].map((item) => (
            <div key={item} className="w-96 px-5 py-5 relative bg-gradient-to-b from-fuchsia-500 to-indigo-400 rounded-[20px] inline-flex flex-col justify-start items-start gap-5 overflow-hidden flex-shrink-0">
              <img className="w-32 h-32 absolute right-4 bottom-4 opacity-30" src="https://placehold.co/125x125" alt="" />
              <div className="self-stretch text-neutral-50 text-3xl font-normal">Claim gifts you bought in Rolls</div>
              <button className="h-8 px-3 py-2 bg-white rounded-[20px] inline-flex justify-center items-center gap-1.5 overflow-hidden">
                <span className="text-gray-800 text-base font-semibold">Claim</span>
              </button>
            </div>
          ))}
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
              <div className="w-0.5 h-6 bg-blue-600 rounded-sm animate-pulse" />
            </div>
            <Search className="w-6 h-6 text-neutral-400 opacity-50" />
          </div>
        </div>

        {/* Products Grid */}
        <div className="self-stretch flex-1 relative inline-flex justify-start items-start gap-2.5 flex-wrap content-start overflow-y-auto">
          {products.map((product) => (
            <div key={product.id} className="w-28 h-44 p-2.5 bg-stone-950 rounded-xl border border-stone-300 backdrop-blur-sm inline-flex flex-col justify-end items-center gap-2 overflow-hidden">
              <div className="flex flex-col justify-start items-center gap-0.5">
                <span className="text-neutral-50 text-xs">{product.name}</span>
                <span className="text-neutral-50/50 text-[10px]">{product.category}</span>
              </div>
              <img className="self-stretch flex-1 rounded-xl object-cover" src={product.image} alt={product.name} />
              <div className="self-stretch px-3 py-2 bg-zinc-800 rounded-[20px] inline-flex justify-center items-center gap-2 overflow-hidden">
                <div className="flex justify-start items-center gap-0.5">
                  <span className="text-neutral-50 text-sm leading-snug">{product.price}</span>
                  <div className="w-3.5 h-3.5 bg-amber-300 rounded" />
                </div>
              </div>
            </div>
          ))}
          <div className="w-16 h-96 absolute right-0 top-0 bg-gradient-to-l from-black to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="w-96 px-14 py-3 bg-black border-t-2 border-zinc-800 inline-flex justify-center items-center gap-4 overflow-hidden">
        <div className="flex justify-start items-center gap-4">
          <div className="w-16 h-14 inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gray-400 rounded" />
            <span className="text-gray-400 text-xs font-medium">PvP</span>
          </div>
          <div className="w-16 h-14 bg-zinc-800 rounded-3xl inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-white rounded" />
            <span className="text-white text-xs font-medium">Market</span>
          </div>
          <div className="w-16 h-14 inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gray-400 rounded" />
            <span className="text-gray-400 text-xs font-medium">Earn</span>
          </div>
          <div className="w-16 h-14 inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gray-400 rounded" />
            <span className="text-gray-400 text-xs font-bold">History</span>
          </div>
        </div>
      </div>
    </div>
  )
}