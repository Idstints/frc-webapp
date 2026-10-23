import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Spinner, IconX, IconDownload } from './ui'

const timeOf = (iso) =>
  new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Private bucket, one folder per ticket number (see the message_attachments migration).
const BUCKET = 'message-files'
const MAX_FILES = 5
const MAX_MB = 5
const ACCEPT = 'image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx'
// Signed links last an hour; the thread re-signs whenever it reloads.
const LINK_SECONDS = 60 * 60

const sizeOf = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
const safeName = (name) => name.replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
const isImage = (type) => type?.startsWith('image/')

const PaperclipIcon = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
  </svg>
)

function Attachment({ file, url }) {
  if (isImage(file.type) && url) {
    return (
      <a className="bb-image" href={url} target="_blank" rel="noopener noreferrer" title={file.name}>
        <img src={url} alt={file.name} loading="lazy" />
      </a>
    )
  }
  return (
    <a className="bb-file" href={url || undefined} target="_blank" rel="noopener noreferrer"
      download={file.name} aria-disabled={!url}>
      <IconDownload />
      <span className="bf-name">{file.name}</span>
      <span className="bf-size">{sizeOf(file.size)}</span>
    </a>
  )
}

// Conversation about one ticket. Threaded on the ticket number rather than a
// single booking, so a follow-up visit continues the same conversation.
export default function MessageThread({ jobCode, requestId, mode }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState(null)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([]) // File objects waiting to be sent
  const [links, setLinks] = useState({}) // storage path -> signed URL
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const fileInputRef = useRef(null)
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

  // Sign any attachment we don't have a link for yet, in one request.
  useEffect(() => {
    const missing = (messages ?? [])
      .flatMap((m) => m.attachments ?? [])
      .map((a) => a.path)
      .filter((p) => p && !(p in links))
    if (!missing.length) return
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, LINK_SECONDS)
      .then(({ data }) => {
        const next = {}
        for (const p of missing) next[p] = ''
        for (const row of data ?? []) if (row.signedUrl) next[row.path] = row.signedUrl
        setLinks((l) => ({ ...l, ...next }))
      })
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  const addFiles = (e) => {
    const picked = [...(e.target.files ?? [])]
    e.target.value = ''
    setError('')
    const next = [...files]
    for (const f of picked) {
      if (next.length >= MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files to one message.`)
        break
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`${f.name} is too big. Each file must be under ${MAX_MB} MB.`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  const send = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if ((!text && !files.length) || sending) return
    setSending(true)
    setError('')

    const attachments = []
    for (const f of files) {
      const path = `${jobCode}/${uuidv4()}-${safeName(f.name)}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined })
      if (upErr) {
        setSending(false)
        setError(`${f.name} could not be uploaded. ${upErr.message}`)
        console.error(upErr)
        return
      }
      attachments.push({ path, name: f.name, type: f.type || 'application/octet-stream', size: f.size })
    }

    const { data, error: err } = await supabase
      .from('repair_messages')
      .insert({
        job_code: jobCode,
        request_id: requestId ?? null,
        sender_id: profile.id,
        sender_kind: isTeam ? 'team' : 'visitor',
        sender_name: profile.full_name ?? '',
        body: text,
        attachments,
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
    setFiles([])
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
                  {m.body && <div className="bb-body">{m.body}</div>}
                  {m.attachments?.length > 0 && (
                    <div className="bb-files">
                      {m.attachments.map((a) => <Attachment key={a.path} file={a} url={links[a.path]} />)}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {files.length > 0 && (
        <div className="compose-files">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="compose-file">
              <span className="cf-name">{f.name}</span>
              <span className="cf-size">{sizeOf(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <IconX />
              </button>
            </span>
          ))}
        </div>
      )}

      <form className="thread-compose" onSubmit={send}>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPT} hidden onChange={addFiles} />
        <button type="button" className="btn btn-secondary attach-btn" title="Attach photos or files"
          aria-label="Attach photos or files" disabled={sending || files.length >= MAX_FILES}
          onClick={() => fileInputRef.current?.click()}>
          <PaperclipIcon />
        </button>
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
        <button className="btn btn-primary" disabled={sending || (!body.trim() && !files.length)}>
          {sending ? (files.length ? 'Uploading…' : 'Sending…') : 'Send'}
        </button>
      </form>
      <p className="thread-hint">Attach photos, PDFs or documents — up to {MAX_FILES} files, {MAX_MB} MB each.</p>

      {!isTeam && (
        <p className="thread-note">
          Messages are read by our volunteers around session days, not every day. If your repair is
          urgent, please call Angliss Neighbourhood House.
        </p>
      )}
    </div>
  )
}
