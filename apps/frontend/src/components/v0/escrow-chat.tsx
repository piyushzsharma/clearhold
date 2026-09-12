'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

export interface ChatProps {
  messages: { id: string; senderName: string; senderAvatarUrl?: string; body: string; timestamp: string; isOwnMessage: boolean }[]
  onSendMessage: (body: string) => void
  isLoading?: boolean
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function EscrowChat({ messages, onSendMessage, isLoading = false }: ChatProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || isLoading) return
    onSendMessage(body)
    setDraft('')
  }

  return (
    <section className="escrow-chat" aria-label="Trade chat">
      <header className="escrow-chat-header">
        <div className="escrow-chat-title">
          <span className="escrow-chat-icon" aria-hidden="true">▱</span>
          <div><h2>Trade Chat</h2><p>Coordinate securely with the counterparty</p></div>
        </div>
        <span className="encrypted-badge"><span aria-hidden="true">⌑</span> Encrypted</span>
      </header>

      <div className="escrow-chat-messages" ref={listRef} aria-live="polite">
        {messages.length === 0 && !isLoading ? <div className="chat-empty"><span className="chat-empty-icon" aria-hidden="true">▱</span><strong>No messages yet</strong><p>Say hello to start the conversation.</p></div> : messages.map((item) => (
          <article className={`chat-message ${item.isOwnMessage ? 'is-own' : ''}`} key={item.id}>
            {item.senderAvatarUrl ? <img className="chat-avatar" src={item.senderAvatarUrl} alt="" /> : <span className="chat-avatar" aria-hidden="true">{initials(item.senderName)}</span>}
            <div className="chat-message-content"><div className="chat-message-meta"><strong>{item.senderName}</strong><time>{item.timestamp}</time></div><p className="chat-bubble">{item.body}</p></div>
          </article>
        ))}
        {isLoading && <div className="chat-typing" aria-label="Counterparty is typing"><span /><span /><span /><em>Typing...</em></div>}
      </div>

      <form className="escrow-chat-composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="escrow-chat-message">Message</label>
        <input id="escrow-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." disabled={isLoading} autoComplete="off" />
        <button type="submit" disabled={!draft.trim() || isLoading} aria-label="Send message">Send<span aria-hidden="true">↑</span></button>
      </form>
    </section>
  )
}

export default EscrowChat
