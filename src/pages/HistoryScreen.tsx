import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Play, X } from "lucide-react";
import { api } from "@/services/api";
import { useTelegram } from "@/hooks/useTelegram";
import { Pagination } from "@/components/ui/pagination";
import type { GameDetailResponse, UserProfile } from "@/types/api";
import { starIcon, discIcon } from "@/assets/icons";

type FilterType = "time" | "luckiest" | "solo";

export function HistoryScreen() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [games, setGames] = useState<GameDetailResponse[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [enhancedGames, setEnhancedGames] = useState<
    (GameDetailResponse & { winnerProfile?: UserProfile })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("time");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleViewReplay = (game: GameDetailResponse) => {
    navigate("/game", {
      state: {
        game_id: game.game_id,
        seed: game.seed,
        mapId: game.map_id,
        participants: game.participants,
        prize: game.total_price,
        total_balls: game.total_balls,
        fullGame: game,
        autoStart: true,
        isReplay: true,
        music_content: game.music_content,
        music_title: game.music_title,
        winner_id: game.winner_id,
      },
    });
  };

  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.id) return;

      try {
        let historyPromise;
        switch (activeFilter) {
          case "time":
            historyPromise = api.getHistoryAll();
            break;
          case "luckiest":
            historyPromise = api.getHistoryLucky();
            break;
          case "solo":
            historyPromise = api.getHistorySolo();
            break;
          default:
            historyPromise = api.getHistoryAll();
        }

        const [history, profile] = await Promise.all([
          historyPromise,
          api.getUserProfile(user.id),
        ]);
        setGames(history as any);
        setUserProfile(profile);

        // For "luckiest" the API returns a different shape (items with nested game and winner)
        if (activeFilter === "luckiest") {
          const luckyItems = (history as any[]) || [];
          const normalized = luckyItems.map((item) => {
            const g = item?.game || {};
            const music = g?.music || {};
            const winnerProfile = g?.winner || item?.user || undefined;
            const mapIds = Array.isArray(g?.map_id) ? g.map_id : (g?.map_id != null ? [g.map_id] : []);

            const normalizedGame: any = {
              game_id: g?.id ?? item?.game_id ?? 0,
              seed: g?.seed || "",
              start_time: g?.start_time || "",
              map_id: mapIds, // keep as array
              total_balls: g?.total_balls ?? 0,
              total_price: g?.total_price ?? 0,
              status: g?.status,
              participants: [],
              start_wait_play: g?.start_wait_play,
              music_title: music?.music_title,
              music_content: music?.music_content,
              winner_id: g?.winner?.id, // take id from winner object
              winnerProfile,
              lucky_balls_count: item?.balls_count,
            };
            return normalizedGame;
          });
          setEnhancedGames(normalized);
        } else {
          // Default shape – fetch winner profiles separately
          const gamesWithProfiles = await Promise.all(
            (history as GameDetailResponse[]).map(async (game) => {
              const participants = game.participants || [];
              if (game.winner_id) {
                try {
                  const winnerProfile = await api.getUserProfile(game.winner_id);
                  return { ...game, participants, winnerProfile };
                } catch (error) {
                  console.error(
                    `Failed to load winner profile for game ${game.game_id}:`,
                    error
                  );
                  return { ...game, participants };
                }
              }
              return { ...game, participants };
            })
          );
          setEnhancedGames(gamesWithProfiles);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user?.id, activeFilter]);

  // Search filtering
  const filteredGames = enhancedGames.filter((game) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const gameId = game.game_id.toString();
    const winnerUsername = game.winnerProfile?.username?.toLowerCase() || "";
    return gameId.includes(query) || winnerUsername.includes(query);
  });

  // Sort games by time when time filter is active
  const sortedGames =
    activeFilter === "time"
      ? [...filteredGames].sort(
          (a, b) =>
            new Date(b.start_time || "").getTime() -
            new Date(a.start_time || "").getTime()
        )
      : filteredGames;

  // Pagination logic
  const totalPages = Math.ceil(sortedGames.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGames = sortedGames.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getWinner = (game: GameDetailResponse) => {
    if (!game.participants || !Array.isArray(game.participants))
      return undefined;
    return game.participants.find((p) => {
      const participant = p.user ? p.user : p;
      return participant.id === game.winner_id;
    });
  };

  const getUserBalls = (game: any) => {
    // For luckiest view, backend provides balls_count for the lucky user
    if (game && typeof game.lucky_balls_count === "number") {
      return game.lucky_balls_count;
    }
    const winner = getWinner(game as GameDetailResponse);
    if (!winner) return 0;
    return winner.balls_count || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-text-secondary">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-end gap-2.5 overflow-hidden pb-20">
      <div className="flex-1 p-2.5 flex flex-col justify-end gap-2.5 overflow-hidden">
        {/* Search Input */}
        <div className="self-stretch flex flex-col justify-start items-start">
          <div className="self-stretch h-12 px-4 bg-zinc-800 rounded-xl inline-flex justify-start items-center gap-3 overflow-hidden">
            <div className="flex-1 flex justify-start items-center gap-1 flex-wrap content-center">
              <input
                type="text"
                placeholder="Search Game"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-neutral-400 text-base font-normal leading-snug outline-none placeholder-neutral-400"
              />
            </div>
            {searchQuery ? (
              <X
                className="w-6 h-6 text-neutral-400 opacity-50 cursor-pointer"
                onClick={() => setSearchQuery("")}
              />
            ) : (
              <Search className="w-6 h-6 text-neutral-400 opacity-50" />
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="self-stretch inline-flex justify-start items-start gap-2.5">
          <button
            onClick={() => setActiveFilter("time")}
            className={`flex-1 px-3 py-3 rounded-lg flex justify-center items-center gap-2 overflow-hidden ${
              activeFilter === "time" ? "" : "bg-zinc-800"
            }`}
            style={
              activeFilter === "time"
                ? {
                    background:
                      "radial-gradient(458.72% 228.94% at 57.65% 24.39%, #444CE7 0%, #B83EFF 30.5%, #E58C4C 60.5%, #444CE7 93.5%), linear-gradient(116deg, #FFF -56.16%, #0078D2 28.08%, #8E4FF8 80.58%)",
                    boxShadow: "0px 5px 22px 0px rgba(207, 62, 255, 0.34)",
                  }
                : {}
            }
          >
            <span className="text-neutral-50 text-sm leading-snug">
              ⌛ By time
            </span>
          </button>
          <button
            onClick={() => setActiveFilter("luckiest")}
            className={`flex-1 px-3 py-3 rounded-lg flex justify-center items-center gap-2 overflow-hidden ${
              activeFilter === "luckiest" ? "" : "bg-zinc-800"
            }`}
            style={
              activeFilter === "luckiest"
                ? {
                    background:
                      "radial-gradient(458.72% 228.94% at 57.65% 24.39%, #444CE7 0%, #B83EFF 30.5%, #E58C4C 60.5%, #444CE7 93.5%), linear-gradient(116deg, #FFF -56.16%, #0078D2 28.08%, #8E4FF8 80.58%)",
                    boxShadow: "0px 5px 22px 0px rgba(207, 62, 255, 0.34)",
                  }
                : {}
            }
          >
            <span className="text-neutral-50 text-sm leading-snug">
              🍀 Luckiest
            </span>
          </button>
          <button
            onClick={() => setActiveFilter("solo")}
            className={`flex-1 px-3 py-3 rounded-lg flex justify-center items-center gap-2 overflow-hidden ${
              activeFilter === "solo" ? "" : "bg-zinc-800"
            }`}
            style={
              activeFilter === "solo"
                ? {
                    background:
                      "radial-gradient(458.72% 228.94% at 57.65% 24.39%, #444CE7 0%, #B83EFF 30.5%, #E58C4C 60.5%, #444CE7 93.5%), linear-gradient(116deg, #FFF -56.16%, #0078D2 28.08%, #8E4FF8 80.58%)",
                    boxShadow: "0px 5px 22px 0px rgba(207, 62, 255, 0.34)",
                  }
                : {}
            }
          >
            <span className="text-neutral-50 text-sm leading-snug">
              👤 Solo
            </span>
          </button>
        </div>

        {/* Games List */}
        <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2.5 overflow-y-auto">
          {currentGames.length === 0 ? (
            <div className="self-stretch flex-1 flex items-center justify-center">
              <p className="text-neutral-400 text-sm">No games found</p>
            </div>
          ) : (
            currentGames.map((game) => {
              console.log(game);

              const userBalls = getUserBalls(game);
              const winnerProfile = game.winnerProfile;

              return (
                <div
                  key={game.game_id}
                  className="self-stretch px-3.5 py-4 bg-stone-950 rounded-[20px] backdrop-blur-sm flex flex-col justify-center items-center gap-5 overflow-hidden"
                >
                  {/* Game Header */}
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="rounded-[20px] flex justify-center items-center gap-2">
                      <span className="text-zinc-500 text-xs leading-snug">
                        GAME #{game.game_id}
                      </span>
                    </div>
                    <div className="rounded-[20px] flex justify-center items-center gap-2 overflow-hidden">
                      <span className="text-zinc-500 text-xs leading-snug truncate max-w-[200px]">
                        {game.start_time
                          ? formatDate(game.start_time)
                          : "Unknown"}{" "}
                        - {game.music_title || "No music"}
                      </span>
                      <Play className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>

                  {/* Winner Info */}
                  <div className="self-stretch rounded-[37px] inline-flex justify-between items-center overflow-hidden">
                    <div className="flex justify-start items-center gap-2.5">
                      {winnerProfile?.avatar_url ? (
                        <img
                          src={winnerProfile.avatar_url}
                          className="w-7 h-7 rounded-full object-cover"
                          alt="avatar"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600">
                            TG
                          </span>
                        </div>
                      )}
                      <span className="text-neutral-50 text-sm leading-snug">
                        @{winnerProfile?.username || `User${game.winner_id}`}
                      </span>
                    </div>
                    <div className="flex justify-start items-center gap-0.5">
                      <img src={starIcon} className="w-6 h-6" alt="star" />
                      <span className="text-neutral-50 text-base leading-snug">
                        {game.total_price}
                      </span>
                    </div>
                  </div>

                  {/* Game Stats */}
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="px-3 py-2 rounded-[20px] flex justify-center items-center gap-2 overflow-hidden">
                      <div className="flex justify-start items-center gap-0.5">
                        <img src={discIcon} className="w-4 h-4" alt="disc" />
                        <span className="text-neutral-50 text-sm leading-snug">
                          {userBalls}
                        </span>
                        <span className="text-neutral-50/40 text-sm leading-snug">
                          {" "}
                          vs {game.total_balls}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewReplay(game)}
                      className="h-8 px-4 py-2 bg-zinc-800 rounded-2xl flex justify-center items-center gap-2 overflow-hidden min-w-[120px]"
                    >
                      <span className="text-white text-base leading-snug">
                        View replay
                      </span>
                      <Play className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {filteredGames.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
