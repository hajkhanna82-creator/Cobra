import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

/**
 * Supabase Realtime room hook.
 *
 * One Supabase Realtime channel per room code.
 * State is broadcast (no DB writes needed for game moves — host fans out
 * the full room object to all subscribers on every change).
 *
 * Room object shape:
 * {
 *   code, host, players:[{name,idx}], maxPlayers, status:"lobby"|"started",
 *   gameState: null | { hands, deck, openPile, currentPlayer, phase, scores },
 *   ts
 * }
 */
export function useRoom({ onRoomUpdate }) {
  const channelRef = useRef(null)
  const codeRef = useRef(null)

  const subscribe = useCallback((code) => {
    if (!supabase) return
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }
    codeRef.current = code
    const channel = supabase.channel('cobra:' + code, {
      config: { broadcast: { self: true } },
    })
    channel
      .on('broadcast', { event: 'room' }, ({ payload }) => {
        onRoomUpdate(payload)
      })
      .subscribe()
    channelRef.current = channel
  }, [onRoomUpdate])

  const broadcast = useCallback((room) => {
    if (!channelRef.current) return Promise.resolve()
    return channelRef.current.send({
      type: 'broadcast',
      event: 'room',
      payload: room,
    })
  }, [])

  const unsubscribe = useCallback(() => {
    if (!supabase || !channelRef.current) return
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
    codeRef.current = null
  }, [])

  useEffect(() => () => unsubscribe(), [unsubscribe])

  return { subscribe, broadcast, unsubscribe }
}

/**
 * Persist room state in Supabase DB so late-joiners and page-refreshes
 * can load current room state.
 *
 * Table: cobra_rooms (id text PK, data jsonb, updated_at timestamptz)
 * RLS: public read, public insert/update (anon key is enough for a game).
 */
export async function saveRoomDB(code, room) {
  if (!supabase) return
  await supabase
    .from('cobra_rooms')
    .upsert({ id: code, data: room, updated_at: new Date().toISOString() })
}

export async function loadRoomDB(code) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('cobra_rooms')
    .select('data')
    .eq('id', code)
    .single()
  if (error || !data) return null
  return data.data
}
