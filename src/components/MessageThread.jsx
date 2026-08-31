import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

const timeOf = (iso) =>
  new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Conversation about one ticket. Threaded on the ticket number rather than a
// single booking, so a follow-up visit continues the same conversation.
export default function MessageThread({ jobCode, requestId, mode }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const isTeam = mode === 'volunteer'

  useEffect(() => {
    let live = true

    supabase
      .from('repair_messages')
      .select('*')
      .eq('job_code', jobCode)
      .order('created_at')
      .then(({ data, error: err }) => {
        if (!live) return
        if (err) {
          setError(err.message)
          setMessages([])
          return
        }
        setMessages(data ?? [])
        supabase.rpc('mark_thread_read', { p_job_code: jobCode })
      })

    const channel = supabase
      .channel(`messages-${jobCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'repair_messages', filter: `job_code=eq.${jobCode}` },
        ({ new: msg }) => setMessages((m) => ((m ?? []).some((x) => x.id === msg.id) ? m : [...(m ?? []), msg])),
      )
      .subscribe()

    return () => {
      live = false
      supabase.removeChannel(channel)
    }
  }, [jobCode])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    const { data, error: err } = await supabase
      .from('repair_messages')
      .insert({
        job_code: jobCode,
        request_id: requestId ?? null,
        sender_id: profile.id,
        sender_kind: isTeam ? 'team' : 'visitor',
        sender_name: profile.full_name ?? '',
        body: text,
      })
      .select()
      .single()
    setSending(false)
    if (err) {
      setError('Your message could not be sent. Please try again.')
      console.error(err)
      return
    }
    setBody('')
    setMessages((m) => ((m ?? []).some((x) => x.id === data.id) ? m : [...(m ?? []), data]))
  }

  return (
    <div className="thread">
      {error && <div className="form-error">{error}</div>}

      <div className="thread-log">
        {messages === null ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>
        ) : messages.length === 0 ? (
          <p className="thread-empty">
            {isTeam
              ? 'No messages yet. Use this to check details with the visitor before the session, or to follow up afterwards.'
              : 'No messages yet. Ask us anything about your repair and the team will reply.'}
          </p>
        ) : (
          messages.map((m) => {
            const mine = isTeam ? m.sender_kind === 'team' : m.sender_kind === 'visitor'
            return (
              <div key={m.id} className={`bubble-row ${mine ? 'mine' : ''}`}>
                <div className="bubble">
                  <div className="bb-who">
                    {m.sender_kind === 'team' ? (m.sender_name || 'Repair Cafe') : (m.sender_name || 'Visitor')}
                    <span className="bb-time">{timeOf(m.created_at)}</span>
                  </div>
                  <div className="bb-body">{m.body}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <form className="thread-compose" onSubmit={send}>
        <textarea
          className="textarea"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isTeam ? 'Message the visitor…' : 'Write a message to the repair team…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e)
          }}
        />
        <button className="btn btn-primary" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>

      {!isTeam && (
        <p className="thread-note">
          Messages are read by our volunteers around session days, not every day. If your repair is
          urgent, please call Angliss Neighbourhood House.
        </p>
      )}
    </div>
  )
}
