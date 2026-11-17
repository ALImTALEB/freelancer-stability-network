"use client";

import { useEffect, useState, type FormEvent } from "react";

export type Recipient = { id: string; name: string };
type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
};
type Conversation = {
  id: string;
  peerId: string;
  peerName: string;
  lastMessage: string;
  updatedAt: string;
};
type History = { messages: Message[]; nextBefore: string | null };
type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

export function Inbox({
  api,
  userId,
  recipient,
}: {
  api: Api;
  userId: string;
  recipient: Recipient | null;
}) {
  const [active, setActive] = useState<{ id?: string; name: string } | null>(
    recipient ? { name: recipient.name } : null,
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api<{ conversations: Conversation[] }>("/conversations")
      .then(({ conversations }) => {
        if (!current) return;
        setConversations(conversations);
        const existing = conversations.find(
          (item) => item.peerId === recipient?.id,
        );
        if (existing)
          setActive((previous) =>
            previous && !previous.id
              ? { id: existing.id, name: existing.peerName }
              : previous,
          );
      })
      .catch((error: Error) => {
        if (current) setError(error.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api, recipient, revision]);

  return (
    <div className="inbox-grid">
      <section className="panel" aria-label="Conversations">
        <div className="inbox-heading">
          <h2>Inbox</h2>
          <button
            className="text-button"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading}
          >
            Refresh inbox
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {loading && !conversations.length && (
          <p role="status">Loading conversations…</p>
        )}
        {!loading && !error && !conversations.length && (
          <p>No conversations yet.</p>
        )}
        <ul className="conversation-list">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                aria-pressed={active?.id === conversation.id}
                onClick={() =>
                  setActive({
                    id: conversation.id,
                    name: conversation.peerName,
                  })
                }
              >
                <strong>{conversation.peerName}</strong>
                <span>{conversation.lastMessage}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {active ? (
        <Thread
          key={active.id ?? recipient?.id}
          api={api}
          userId={userId}
          name={active.name}
          conversationId={active.id}
          recipientId={recipient?.id}
          onSent={(id) => {
            setActive((previous) =>
              previous === active ? { id, name: active.name } : previous,
            );
            setRevision((value) => value + 1);
          }}
        />
      ) : (
        <section className="panel">
          <h2>Messages</h2>
          <p>Select a conversation to read and reply.</p>
        </section>
      )}
    </div>
  );
}

function Thread({
  api,
  userId,
  name,
  conversationId,
  recipientId,
  onSent,
}: {
  api: Api;
  userId: string;
  name: string;
  conversationId?: string;
  recipientId?: string;
  onSent: (id: string) => void;
}) {
  const [history, setHistory] = useState<History>({
    messages: [],
    nextBefore: null,
  });
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!conversationId);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!conversationId) return;
    let current = true;
    setLoading(true);
    setError("");
    api<History>("/conversations/" + conversationId)
      .then((data) => {
        if (current) setHistory(data);
      })
      .catch((error: Error) => {
        if (current) setError(error.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api, conversationId, revision]);

  async function loadOlder() {
    setBusy(true);
    setError("");
    try {
      const older = await api<History>(
        `/conversations/${conversationId}?before=${history.nextBefore}`,
      );
      setHistory({
        messages: [...older.messages, ...history.messages],
        nextBefore: older.nextBefore,
      });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || !content.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { message } = await api<{ message: Message }>("/messages", "POST", {
        ...(conversationId ? { conversationId } : { recipientId }),
        content,
      });
      setHistory((previous) => ({
        ...previous,
        messages: [...previous.messages, message],
      }));
      setContent("");
      onSent(message.conversationId);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel message-thread" aria-label="Conversation">
      <div className="inbox-heading">
        <h2>{name}</h2>
        {conversationId && (
          <button
            className="text-button"
            disabled={loading || busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh messages
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading messages…</p>}
      {history.nextBefore && (
        <button
          className="text-button"
          disabled={loading || busy}
          onClick={loadOlder}
        >
          Load older messages
        </button>
      )}
      <ol className="message-list">
        {history.messages.map((message) => (
          <li
            className={message.senderId === userId ? "message-own" : ""}
            key={message.id}
          >
            <strong>{message.senderId === userId ? "You" : name}</strong>
            <p>{message.content}</p>
            <time dateTime={message.createdAt}>
              {new Date(message.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
      <form onSubmit={send}>
        <label>
          Message
          <textarea
            rows={3}
            maxLength={4000}
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <button
          className="dark-button"
          disabled={busy || loading || !content.trim()}
        >
          Send message
        </button>
      </form>
    </section>
  );
}
