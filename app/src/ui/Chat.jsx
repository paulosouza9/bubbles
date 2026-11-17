// The chat that always knows what is on screen, and "Ask Sherpas" on any selected text.
import { useEffect, useRef, useState } from "react";
import { listen, speak } from "../audio.js";
import { useStore } from "../store.js";

const SUGGEST = ["What does this mean?", "Is this good or bad for me?", "What can I do about it?"];
const FOLLOW_UP = "Is everything clear, or would you like to speak with a person?";

// A person with a headset: the help desk.
// Drawn for 22px: below that the headset and the head run together.
export function HeadsetIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3.3" />
      <path d="M5.6 12.6V10a6.4 6.4 0 0 1 12.8 0v2.6" />
      <rect x="4.3" y="10.4" width="2.6" height="4" rx="1.3" fill="currentColor" stroke="none" />
      <rect x="17.1" y="10.4" width="2.6" height="4" rx="1.3" fill="currentColor" stroke="none" />
      <path d="M18.4 14.4c0 1.3-1 2.1-2.6 2.1h-1.6" />
      <path d="M6.2 23a5.8 5.8 0 0 1 11.6 0" />
    </svg>
  );
}

export function MicButton({ onText, className = "" }) {
  const [state, setState] = useState("idle");
  const ctl = useRef(null);
  const serverStt = useStore((s) => s.status?.voice?.stt === "elevenlabs");
  const showToast = useStore((s) => s.showToast);
  const toggle = () => {
    if (state === "listening") return ctl.current?.stop();
    ctl.current = listen({
      serverStt,
      onState: setState,
      onText: (t) => {
        setState("idle");
        if (t) onText(t);
      },
      onError: (e) => {
        setState("idle");
        showToast({ text: `The microphone did not work (${e.message}). You can type instead.` });
      },
    });
  };
  return (
    <button type="button" className={`icon-btn mic ${state} ${className}`} onClick={toggle} aria-label={state === "listening" ? "Stop listening" : "Speak"} title={state === "listening" ? "Tap to stop" : "Tap and speak"}>
      {state === "thinking" ? "…" : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export function ChatBar() {
  const chat = useStore((s) => s.chat);
  const focusTitle = useStore((s) => s.plan.bubbles.find((b) => b.id === s.focus)?.title);
  const level = useStore((s) => s.level);
  const { ask, openChat, closeChat, runAction, openSupport, answerFollowUp } = useStore.getState();
  const input = useRef();
  const [text, setText] = useState("");
  const list = useRef();
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, chat.pending, chat.open]);
  const send = async (q) => {
    const question = (q ?? text).trim();
    if (!question || chat.pending) return;
    setText("");
    const reply = await ask(question);
    if (reply?.text) speak(reply.followUp ? `${reply.text} ${FOLLOW_UP}` : reply.text);
  };
  const about = level <= 2 && focusTitle ? focusTitle.toLowerCase() : "your plan";
  return (
    <div className={`chat ${chat.open ? "open" : ""}`}>
      {chat.open && (
        <div className="glass chat-sheet" role="dialog" aria-label="Ask Sherpas">
          <header className="sheet-head">
            <div>
              <div className="eyebrow">{chat.support ? "Help" : "Ask Sherpas"}</div>
              <div className="mute small">{chat.support ? "Ask your question. A person is one tap away if you need one." : `Answers come only from your plan. On screen: ${about}.`}</div>
            </div>
            <button className="link chat-human" onClick={() => useStore.getState().setHumanOpen(true)}>
              Talk to a person
            </button>
            <button className="icon-btn" onClick={closeChat} aria-label="Close the chat">
              ✕
            </button>
          </header>
          <div className="chat-list" ref={list}>
            {chat.messages.length === 0 && !chat.quote && <p className="mute">Ask about anything you see. For example: “Why does this matter for me?”</p>}
            {chat.messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.quote && <div className="quote">About: “{m.quote}”</div>}
                <div className="bubble-msg" data-ask={m.role === "assistant" ? "" : undefined}>
                  {m.text}
                </div>
                {m.actions?.length > 0 && (
                  <div className="msg-actions">
                    {m.actions.map((a, k) => (
                      <button key={k} className="btn small" onClick={() => runAction(a)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.followUp && (
                  <div className="follow-up">
                    {m.followUp === "open" ? (
                      <>
                        <p>{FOLLOW_UP}</p>
                        <div className="msg-actions">
                          <button className="btn small" onClick={() => answerFollowUp(i, "clear")}>
                            Yes, all clear
                          </button>
                          <button className="btn small primary" onClick={() => answerFollowUp(i, "human")}>
                            Talk to a person
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="mute small">{m.followUp === "clear" ? "Glad that helped. Ask anything else whenever you like." : "You asked to speak with a person."}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {chat.pending && (
              <div className="msg assistant">
                <div className="bubble-msg typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>
          {chat.quote && (
            <div className="quote-bar">
              <div className="quote">About: “{chat.quote}”</div>
              <div className="suggest">
                {SUGGEST.map((q) => (
                  <button key={q} className="btn small" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <form
        className="glass chat-bar"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button
          type="button"
          className={`icon-btn help-btn ${chat.support && chat.open ? "on" : ""}`}
          onClick={() => {
            openSupport();
            setTimeout(() => input.current?.focus(), 0);
          }}
          aria-label="Get help"
          title="Get help: ask a question, or reach a person"
        >
          <HeadsetIcon />
        </button>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => !chat.open && openChat(chat.quote)} placeholder={`Ask anything about ${about}…`} aria-label="Ask a question" />
        <MicButton onText={(t) => send(t)} />
        <button className="btn primary send" type="submit" disabled={!text.trim() || chat.pending}>
          Ask
        </button>
      </form>
    </div>
  );
}

export function AskPopover() {
  const [sel, setSel] = useState(null);
  const openChat = useStore((s) => s.openChat);
  useEffect(() => {
    let t;
    const check = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString().trim();
        if (!s || s.isCollapsed || !text || text.length < 2 || text.length > 400) return setSel(null);
        const node = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
        if (!node?.closest?.("[data-ask]")) return setSel(null);
        const r = s.getRangeAt(0).getBoundingClientRect();
        if (!r.width && !r.height) return setSel(null);
        setSel({ text, x: Math.min(window.innerWidth - 90, Math.max(90, r.left + r.width / 2)), y: r.top < 70 ? r.bottom + 10 : r.top - 46 });
      }, 180);
    };
    document.addEventListener("selectionchange", check);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  if (!sel) return null;
  return (
    <button
      className="glass ask-pop"
      style={{ left: sel.x, top: sel.y }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        openChat(sel.text);
        window.getSelection()?.removeAllRanges();
        setSel(null);
      }}
    >
      Ask Sherpas
    </button>
  );
}
