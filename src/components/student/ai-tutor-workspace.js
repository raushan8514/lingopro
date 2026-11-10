"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Languages,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AI_TUTOR_LANGUAGES,
  AI_TUTOR_LEVELS,
  AI_TUTOR_MODES,
} from "@/lib/ai-tutor/validation";

const MODE_LABELS = {
  conversation: "Conversation",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  writing: "Writing coach",
  interview: "Interview practice",
  "daily-practice": "Daily practice",
};

const MODE_DESCRIPTIONS = {
  conversation: "Build fluency through a relaxed, guided conversation.",
  grammar: "Get clear corrections and understand the patterns behind them.",
  vocabulary: "Learn useful words through short, natural examples.",
  writing: "Polish a piece of writing while keeping your own voice.",
  interview: "Practice realistic questions one response at a time.",
  "daily-practice": "Complete a short exercise with personal feedback.",
};

const SUGGESTIONS = {
  conversation: "Let's talk about my weekend.",
  grammar: "Can you explain when to use the past tense?",
  vocabulary: "Teach me useful words for ordering at a cafe.",
  writing: "I'd like help making my writing sound more natural.",
  interview: "Let's practice introducing myself in an interview.",
  "daily-practice": "Give me a quick practice for today.",
};

function shortDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function messageDate(value) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function responseJson(response) {
  return response.json();
}

export default function AiTutorWorkspace({
  conversations: initialConversations,
  vocabulary: initialVocabulary,
  selectedConversation: initialConversation,
  messages: initialMessages,
  isGeminiConfigured,
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [vocabulary, setVocabulary] = useState(initialVocabulary);
  const [selectedConversation, setSelectedConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [mode, setMode] = useState(initialConversation?.mode || "conversation");
  const [language, setLanguage] = useState(initialConversation?.language || "Spanish");
  const [level, setLevel] = useState(initialConversation?.level || "A2");
  const [topic, setTopic] = useState(initialConversation?.topic || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectingConversation, setSelectingConversation] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("tutor");
  const [showVocabularyForm, setShowVocabularyForm] = useState(false);
  const [savingVocabulary, setSavingVocabulary] = useState(false);
  const [vocabularyForm, setVocabularyForm] = useState({
    word: "",
    meaning: "",
    example: "",
  });
  const controllerRef = useRef(null);
  const selectionIdRef = useRef(0);
  const composerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentMode = selectedConversation?.mode || mode;
  const currentLanguage = selectedConversation?.language || language;
  const currentLevel = selectedConversation?.level || level;
  const currentTopic = selectedConversation?.topic || topic;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function startNewConversation() {
    if (busy || selectingConversation) return;
    selectionIdRef.current += 1;
    setSelectedConversation(null);
    setMessages([]);
    setMode("conversation");
    setLanguage("Spanish");
    setLevel("A2");
    setTopic("");
    setError("");
    setActiveView("tutor");
    composerRef.current?.focus();
  }

  async function selectConversation(conversation) {
    if (busy || selectingConversation || conversation.id === selectedConversation?.id) return;
    const selectionId = ++selectionIdRef.current;
    setSelectingConversation(true);
    setError("");
    setSelectedConversation(conversation);
    setMessages([]);
    setMode(conversation.mode);
    setLanguage(conversation.language);
    setLevel(conversation.level);
    setTopic(conversation.topic || "");
    setActiveView("tutor");

    try {
      const response = await fetch(
        `/api/student/ai-tutor/conversations/${encodeURIComponent(conversation.id)}`,
        { cache: "no-store" },
      );
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || "This conversation could not be loaded.");
      if (selectionId !== selectionIdRef.current) return;
      setSelectedConversation(result.conversation);
      setMessages(result.messages || []);
    } catch (loadError) {
      if (selectionId !== selectionIdRef.current) return;
      setError(loadError.message || "This conversation could not be loaded.");
    } finally {
      if (selectionId === selectionIdRef.current) setSelectingConversation(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content || busy || selectingConversation) return;

    setError("");
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/student/ai-tutor/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationId: selectedConversation?.id || null,
          mode: currentMode,
          language: currentLanguage,
          level: currentLevel,
          topic: currentTopic,
        }),
        signal: controller.signal,
      });
      const result = await responseJson(response);

      if (result.conversation && result.userMessagePersisted) {
        setSelectedConversation(result.conversation);
        setConversations((items) => [
          result.conversation,
          ...items.filter(({ id }) => id !== result.conversation.id),
        ].slice(0, 50));
        setMessages((items) => [...items, result.userMessage]);
      }
      if (!response.ok) throw new Error(result.error || "The tutor could not respond.");

      setSelectedConversation(result.conversation);
      setConversations((items) => [
        result.conversation,
        ...items.filter(({ id }) => id !== result.conversation.id),
      ].slice(0, 50));
      setMessages((items) => [...items, result.userMessage, result.assistantMessage]);
    } catch (sendError) {
      if (sendError.name === "AbortError") {
        setMessage(content);
        setError("Stopped waiting. Review this conversation before resending; the request may still be processing.");
      } else {
        setError(sendError.message || "The tutor could not respond right now.");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  function stopGeneration() {
    controllerRef.current?.abort();
  }

  async function deleteConversation(conversation) {
    if (busy || selectingConversation || !window.confirm(`Delete “${conversation.title}” and its messages?`)) return;
    setError("");
    try {
      const response = await fetch(
        `/api/student/ai-tutor/conversations/${encodeURIComponent(conversation.id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      );
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || "This conversation could not be deleted.");
      const remaining = conversations.filter(({ id }) => id !== conversation.id);
      setConversations(remaining);
      if (selectedConversation?.id === conversation.id) {
        setSelectedConversation(null);
        setMessages([]);
        setMode("conversation");
        setLanguage("Spanish");
        setLevel("A2");
        setTopic("");
      }
    } catch (deleteError) {
      setError(deleteError.message || "This conversation could not be deleted.");
    }
  }

  async function saveVocabulary(event) {
    event.preventDefault();
    if (savingVocabulary) return;
    setError("");
    setSavingVocabulary(true);
    try {
      const response = await fetch("/api/student/ai-tutor/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...vocabularyForm,
          language: currentLanguage,
          conversationId: selectedConversation?.id || null,
        }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || "The vocabulary item could not be saved.");
      setVocabulary((items) => [result.vocabulary, ...items]);
      setVocabularyForm({ word: "", meaning: "", example: "" });
      setShowVocabularyForm(false);
    } catch (saveError) {
      setError(saveError.message || "The vocabulary item could not be saved.");
    } finally {
      setSavingVocabulary(false);
    }
  }

  async function deleteVocabulary(item) {
    setError("");
    try {
      const response = await fetch("/api/student/ai-tutor/vocabulary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || "The vocabulary item could not be deleted.");
      setVocabulary((items) => items.filter(({ id }) => id !== item.id));
    } catch (deleteError) {
      setError(deleteError.message || "The vocabulary item could not be deleted.");
    }
  }

  return (
    <>
      <header className="student-page-heading ai-tutor-heading">
        <div>
          <p className="student-eyebrow">PERSONAL LANGUAGE PRACTICE</p>
          <h1>AI language tutor</h1>
          <p className="student-page-description">
            Practice at your pace with focused guidance that meets you where you are.
          </p>
        </div>
      </header>

      {!isGeminiConfigured && (
        <div className="ai-tutor-notice" role="status">
          <CircleHelp size={18} aria-hidden="true" />
          <p>
            The tutor is not available until an administrator configures the server-side
            Gemini API key. Your messages will not be sent anywhere until then.
          </p>
        </div>
      )}

      <div className="ai-tutor-layout">
        <aside className="ai-tutor-sidebar" aria-label="Tutor conversations">
          <button
            className="ai-tutor-new-button"
            type="button"
            onClick={startNewConversation}
            disabled={busy || selectingConversation}
          >
            <Plus size={17} aria-hidden="true" />
            New conversation
          </button>

          <div className="ai-tutor-sidebar-tabs" role="group" aria-label="Tutor library">
            <button
              className={activeView === "tutor" ? "is-active" : ""}
              type="button"
              aria-pressed={activeView === "tutor"}
              onClick={() => setActiveView("tutor")}
            >
              <MessageCircle size={16} aria-hidden="true" />
              Chats
            </button>
            <button
              className={activeView === "vocabulary" ? "is-active" : ""}
              type="button"
              aria-pressed={activeView === "vocabulary"}
              onClick={() => setActiveView("vocabulary")}
            >
              <BookOpen size={16} aria-hidden="true" />
              Vocabulary
              <span>{vocabulary.length}</span>
            </button>
          </div>

          {activeView === "tutor" ? (
            <div className="ai-tutor-conversation-list">
              <p className="ai-tutor-list-label">RECENT CONVERSATIONS</p>
              {conversations.length ? conversations.map((conversation) => (
                <div
                  className={`ai-tutor-conversation${selectedConversation?.id === conversation.id ? " is-active" : ""}`}
                  key={conversation.id}
                >
                  <button
                    className="ai-tutor-conversation-select"
                    type="button"
                    onClick={() => selectConversation(conversation)}
                    disabled={busy || selectingConversation}
                    aria-current={selectedConversation?.id === conversation.id ? "page" : undefined}
                  >
                    <span>{conversation.title}</span>
                    <small>{MODE_LABELS[conversation.mode]} · {shortDate(conversation.updated_at)}</small>
                  </button>
                  <button
                    className="ai-tutor-icon-button ai-tutor-delete-conversation"
                    type="button"
                    onClick={() => deleteConversation(conversation)}
                    disabled={busy || selectingConversation}
                    aria-label={`Delete ${conversation.title}`}
                    title="Delete conversation"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              )) : (
                <p className="ai-tutor-sidebar-empty">Your saved conversations will appear here.</p>
              )}
            </div>
          ) : (
            <div className="ai-tutor-vocabulary-list">
              <div className="ai-tutor-list-heading">
                <p className="ai-tutor-list-label">SAVED WORDS</p>
                <button
                  type="button"
                  className="ai-tutor-add-word"
                  onClick={() => setShowVocabularyForm((value) => !value)}
                >
                  {showVocabularyForm ? <X size={15} /> : <Plus size={15} />}
                  {showVocabularyForm ? "Close" : "Add word"}
                </button>
              </div>
              {showVocabularyForm && (
                <form className="ai-tutor-vocab-form" onSubmit={saveVocabulary}>
                  <label>
                    Word or phrase
                    <input
                      value={vocabularyForm.word}
                      maxLength={100}
                      required
                      onChange={(event) => setVocabularyForm((item) => ({ ...item, word: event.target.value }))}
                    />
                  </label>
                  <label>
                    Meaning
                    <input
                      value={vocabularyForm.meaning}
                      maxLength={200}
                      required
                      onChange={(event) => setVocabularyForm((item) => ({ ...item, meaning: event.target.value }))}
                    />
                  </label>
                  <label>
                    Example sentence (optional)
                    <textarea
                      value={vocabularyForm.example}
                      maxLength={500}
                      rows={2}
                      onChange={(event) => setVocabularyForm((item) => ({ ...item, example: event.target.value }))}
                    />
                  </label>
                  <button className="ai-tutor-save-button" type="submit" disabled={savingVocabulary}>
                    {savingVocabulary ? <LoaderCircle size={15} className="ai-tutor-spin" /> : <Check size={15} />}
                    Save word
                  </button>
                </form>
              )}
              {vocabulary.length ? vocabulary.map((item) => (
                <article className="ai-tutor-vocab-item" key={item.id}>
                  <div>
                    <strong>{item.word}</strong>
                    <small>{item.language}</small>
                  </div>
                  <p>{item.meaning}</p>
                  {item.example && <blockquote>{item.example}</blockquote>}
                  <button
                    type="button"
                    className="ai-tutor-vocab-remove"
                    onClick={() => deleteVocabulary(item)}
                    aria-label={`Remove ${item.word} from saved vocabulary`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove
                  </button>
                </article>
              )) : (
                <p className="ai-tutor-sidebar-empty">
                  Save words and phrases here to review them later.
                </p>
              )}
            </div>
          )}
        </aside>

        <section className="ai-tutor-main" aria-label="Language tutor" aria-busy={busy || selectingConversation}>
          <div className="ai-tutor-session">
            <div className="ai-tutor-session-title">
              <span className="ai-tutor-mark"><Sparkles size={18} aria-hidden="true" /></span>
              <div>
                <h2>{selectedConversation?.title || "Start a practice session"}</h2>
                <p>{MODE_DESCRIPTIONS[currentMode]}</p>
              </div>
            </div>

            <div className="ai-tutor-settings">
              <label>
                Practice mode
                <span className="ai-tutor-select-wrap">
                  <select value={currentMode} disabled={Boolean(selectedConversation) || busy || selectingConversation} onChange={(event) => setMode(event.target.value)}>
                    {AI_TUTOR_MODES.map((item) => (
                      <option key={item} value={item}>{MODE_LABELS[item]}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
              </label>
              <label>
                Learning language
                <span className="ai-tutor-select-wrap">
                  <select value={currentLanguage} disabled={Boolean(selectedConversation) || busy || selectingConversation} onChange={(event) => setLanguage(event.target.value)}>
                    {AI_TUTOR_LANGUAGES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
              </label>
              <label>
                Level
                <span className="ai-tutor-select-wrap">
                  <select value={currentLevel} disabled={Boolean(selectedConversation) || busy || selectingConversation} onChange={(event) => setLevel(event.target.value)}>
                    {AI_TUTOR_LEVELS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
              </label>
              <label className="ai-tutor-topic-field">
                Topic <span>optional</span>
                <input
                  value={currentTopic}
                  maxLength={80}
                  disabled={Boolean(selectedConversation) || busy || selectingConversation}
                  placeholder="Travel, work, everyday life…"
                  onChange={(event) => setTopic(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="ai-tutor-messages" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 && !busy ? (
              <div className="ai-tutor-welcome">
                <span className="ai-tutor-welcome-icon"><Languages size={24} aria-hidden="true" /></span>
                <h3>A little practice goes a long way.</h3>
                <p>{MODE_DESCRIPTIONS[currentMode]} Choose a prompt below, or ask your own question.</p>
                <button
                  type="button"
                  className="ai-tutor-suggestion"
                  onClick={() => {
                    setMessage(SUGGESTIONS[currentMode]);
                    composerRef.current?.focus();
                  }}
                  disabled={busy}
                >
                  <Sparkles size={15} aria-hidden="true" />
                  {SUGGESTIONS[currentMode]}
                </button>
              </div>
            ) : (
              messages.map((item) => (
                <article
                  className={`ai-tutor-message is-${item.role}`}
                  key={item.id}
                >
                  {item.role === "assistant" && (
                    <span className="ai-tutor-message-avatar"><Sparkles size={15} aria-hidden="true" /></span>
                  )}
                  <div className="ai-tutor-message-body">
                    <div className="ai-tutor-message-meta">
                      <strong>{item.role === "assistant" ? "LingoPro tutor" : "You"}</strong>
                      <time dateTime={item.created_at}>{messageDate(item.created_at)}</time>
                    </div>
                    <p>{item.content}</p>
                  </div>
                </article>
              ))
            )}
            {busy && (
              <div className="ai-tutor-generating" role="status">
                <span className="ai-tutor-message-avatar"><Sparkles size={15} aria-hidden="true" /></span>
                <LoaderCircle size={16} className="ai-tutor-spin" aria-hidden="true" />
                <span>Your tutor is preparing a response…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="ai-tutor-error" role="alert">
              <p>{error}</p>
              <button type="button" className="ai-tutor-icon-button" onClick={() => setError("")} aria-label="Dismiss message">
                <X size={16} />
              </button>
            </div>
          )}

          <form className="ai-tutor-composer" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="ai-tutor-message">Your message</label>
            <textarea
              id="ai-tutor-message"
              ref={composerRef}
              value={message}
              maxLength={1500}
              rows={3}
              placeholder={`Write to your ${currentLanguage} tutor…`}
              onChange={(event) => setMessage(event.target.value)}
              disabled={!isGeminiConfigured || busy || selectingConversation}
              required
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="ai-tutor-composer-footer">
              <span><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + Enter to send · {message.length}/1500</span>
              {busy ? (
                <button className="ai-tutor-send-button is-stop" type="button" onClick={stopGeneration}>
                  <X size={16} aria-hidden="true" />
                  Stop
                </button>
              ) : (
                <button className="ai-tutor-send-button" type="submit" disabled={!message.trim() || !isGeminiConfigured || selectingConversation}>
                  <Send size={16} aria-hidden="true" />
                  Send
                </button>
              )}
            </div>
          </form>
          <p className="ai-tutor-privacy">
            <CircleHelp size={14} aria-hidden="true" />
            Your conversation is saved to your account. Gemini interaction storage is disabled.
            Avoid sharing sensitive personal information.
          </p>
        </section>
      </div>
    </>
  );
}
