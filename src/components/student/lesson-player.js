"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  completeStudentLesson,
  recordStudentLessonAccess,
  saveStudentLessonPosition,
} from "@/app/student/actions";
import { Button } from "@/components/ui/button";

let youtubeApiPromise;

function mediaMessage(source, type) {
  if (source?.message) return source.message;
  return type === "video"
    ? "This lesson does not have a supported video source."
    : "This lesson does not have a supported audio source.";
}

function isMediaSourceUnavailable(source) {
  return !source || ["unavailable", "unsupported"].includes(source.kind);
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    let settled = false;
    let timeout;
    const finish = () => {
      if (settled || !window.YT?.Player) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(window.YT);
    };

    window.onYouTubeIframeAPIReady = () => {
      try {
        previousCallback?.();
      } finally {
        finish();
      }
    };

    let script = document.getElementById("lingopro-youtube-iframe-api");
    if (!script) {
      script = document.createElement("script");
      script.id = "lingopro-youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error("The video provider could not be reached."));
      };
      document.head.appendChild(script);
    }

    timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("The video player did not finish loading."));
    }, 15000);
    Promise.resolve().then(() => {
      if (window.YT?.Player) {
        finish();
      }
    });
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });
}

function YouTubeLessonPlayer({
  videoId,
  initialPosition,
  onPosition,
  onEnded,
  onError,
}) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const callbacksRef = useRef({ onPosition, onEnded, onError });

  useEffect(() => {
    callbacksRef.current = { onPosition, onEnded, onError };
  }, [onEnded, onError, onPosition]);

  useEffect(() => {
    let cancelled = false;
    let intervalId;
    let player;

    loadYouTubeApi()
      .then((youtube) => {
        if (cancelled || !hostRef.current) return;
        player = new youtube.Player(hostRef.current, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            controls: 1,
            enablejsapi: 1,
            playsinline: 1,
            rel: 0,
            start: Math.max(0, Math.floor(initialPosition || 0)),
            origin: window.location.origin,
          },
          events: {
            onReady(event) {
              playerRef.current = event.target;
              event.target.getIframe()?.setAttribute(
                "title",
                "Lesson video player",
              );
              if (initialPosition > 0) {
                event.target.seekTo(initialPosition, true);
              }
            },
            onStateChange(event) {
              const state = event.data;
              if (state === 1) {
                window.clearInterval(intervalId);
                intervalId = window.setInterval(() => {
                  const current = playerRef.current;
                  if (current?.getCurrentTime) {
                    callbacksRef.current.onPosition(current.getCurrentTime());
                  }
                }, 15000);
              } else {
                window.clearInterval(intervalId);
                const current = playerRef.current;
                if (current?.getCurrentTime) {
                  callbacksRef.current.onPosition(current.getCurrentTime());
                }
                if (state === 0) callbacksRef.current.onEnded();
              }
            },
            onError() {
              callbacksRef.current.onError(
                "The video provider could not play this lesson.",
              );
            },
          },
        });
        playerRef.current = player;
      })
      .catch((error) => {
        if (!cancelled) {
          callbacksRef.current.onError(
            error.message || "The video player could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      playerRef.current = null;
      player?.destroy();
    };
  }, [initialPosition, videoId]);

  return <div className="learning-youtube-player" ref={hostRef} />;
}

export default function LessonPlayer({
  lessonId,
  contentType,
  media,
  initialPosition = 0,
  duration = null,
  completed = false,
}) {
  const router = useRouter();
  const mediaRef = useRef(null);
  const savingRef = useRef(null);
  const queuedPositionRef = useRef(null);
  const completionSourceRef = useRef("MANUAL");
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedState, setCompletedState] = useState(completed);
  const [syncMessage, setSyncMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [retryKind, setRetryKind] = useState(null);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [accessRecorded, setAccessRecorded] = useState(false);
  const mediaType =
    ["VIDEO", "MIXED"].includes(contentType) && media?.video
      ? "video"
      : ["AUDIO", "MIXED"].includes(contentType) && media?.audio
        ? "audio"
        : ["VIDEO", "MIXED"].includes(contentType)
          ? "video"
          : contentType === "AUDIO"
            ? "audio"
            : null;
  const source = mediaType ? media?.[mediaType] : null;

  const requestAccess = useCallback(async () => {
    try {
      return await recordStudentLessonAccess(lessonId);
    } catch {
      return { error: "Your lesson access could not be synchronized." };
    }
  }, [lessonId]);

  useEffect(() => {
    let active = true;
    requestAccess().then((result) => {
      if (!active) return;
      if (result?.error) setErrorMessage(result.error);
      else setAccessRecorded(true);
    });
    return () => {
      active = false;
    };
  }, [requestAccess]);

  const submitPosition = useCallback(async (position) => {
    setSyncMessage("Saving progress…");
    try {
      const result = await saveStudentLessonPosition(lessonId, position);
      if (result?.error) {
        setSyncMessage("");
        setErrorMessage(result.error);
        setRetryKind("progress");
        return result;
      }
      setErrorMessage("");
      setRetryKind(null);
      setSyncMessage("Progress saved to your account");
      return result;
    } catch {
      setSyncMessage("");
      setErrorMessage("Playback progress could not be saved. Check your connection.");
      setRetryKind("progress");
      return { error: "Playback progress could not be saved." };
    }
  }, [lessonId]);

  const savePosition = useCallback(async (position) => {
    const rounded = Math.max(0, Math.floor(Number(position) || 0));
    const bounded = duration
      ? Math.min(rounded, duration)
      : Math.min(rounded, 604800);
    if (savingRef.current) {
      queuedPositionRef.current = bounded;
      return savingRef.current;
    }

    const request = (async () => {
      let nextPosition = bounded;
      let result;
      while (nextPosition !== null) {
        result = await submitPosition(nextPosition);
        if (result?.error) {
          queuedPositionRef.current = null;
          break;
        }
        nextPosition = queuedPositionRef.current;
        queuedPositionRef.current = null;
      }
      return result;
    })();
    savingRef.current = request;
    try {
      return await request;
    } finally {
      if (savingRef.current === request) savingRef.current = null;
    }
  }, [duration, submitPosition]);

  useEffect(() => {
    if (!isPlaying || !mediaRef.current || source?.kind !== "file") return undefined;
    const timer = window.setInterval(() => {
      const element = mediaRef.current;
      if (element && !element.paused) savePosition(element.currentTime);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isPlaying, savePosition, source?.kind]);

  async function complete(sourceType) {
    setErrorMessage("");
    setRetryKind(null);
    completionSourceRef.current = sourceType;
    try {
      const result = await completeStudentLesson(lessonId, sourceType);
      if (result?.error) {
        setErrorMessage(result.error);
        setRetryKind("completion");
        return false;
      }
      setCompletedState(true);
      setSyncMessage("Lesson completion saved");
      router.refresh();
      return true;
    } catch {
      setErrorMessage("Lesson completion could not be saved. Please try again.");
      setRetryKind("completion");
      return false;
    }
  }

  async function handleMediaEnded() {
    const element = mediaRef.current;
    const finalPosition =
      element?.currentTime ||
      duration ||
      initialPosition;
    const saved = await savePosition(finalPosition);
    if (!saved?.error) await complete("MEDIA");
  }

  function onMetadata(event) {
    const element = event.currentTarget;
    if (
      Number.isFinite(element.duration) &&
      initialPosition > 0 &&
      initialPosition < element.duration
    ) {
      element.currentTime = initialPosition;
    }
  }

  async function handleManualCompletion() {
    const element = mediaRef.current;
    if (element && !element.paused) {
      element.pause();
    }
    await complete("MANUAL");
  }

  async function handleRetry() {
    setErrorMessage("");
    setRetryKind(null);
    if (retryKind === "access") {
      const result = await requestAccess();
      if (result?.error) {
        setErrorMessage(result.error);
        setRetryKind("access");
      } else {
        setAccessRecorded(true);
      }
    } else if (retryKind === "progress") {
      await savePosition(mediaRef.current?.currentTime || initialPosition);
    } else if (retryKind === "completion") {
      await complete(completionSourceRef.current);
    }
  }

  if (!accessRecorded) {
    return (
      <section className="learning-player-panel student-panel" aria-busy="true">
        {errorMessage ? (
          <>
            <p className="learning-error-message" role="alert">{errorMessage}</p>
            <Button type="button" variant="secondary" onClick={handleRetry}>
              <RefreshCw size={15} aria-hidden="true" /> Retry
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="ui-spinner-icon" size={22} aria-hidden="true" />
            <p role="status">Preparing your secure lesson…</p>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="learning-player-panel student-panel">
      {mediaType && source?.kind === "file" && (
        <div
          className={`learning-media-frame is-${mediaType}`}
          key={`media-${mediaAttempt}`}
        >
          {mediaType === "video" ? (
            <video
              ref={mediaRef}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={onMetadata}
              onPlay={() => {
                setIsPlaying(true);
                savePosition(mediaRef.current?.currentTime || 0);
              }}
              onPause={() => {
                setIsPlaying(false);
                if (mediaRef.current) savePosition(mediaRef.current.currentTime);
              }}
              onEnded={handleMediaEnded}
              onError={() => setMediaError("This video could not be loaded. Check your connection or try again later.")}
            >
              <source src={source.url} />
              Your browser does not support embedded video.
            </video>
          ) : (
            <div className="learning-audio-frame">
              <audio
                ref={mediaRef}
                controls
                preload="metadata"
                onLoadedMetadata={onMetadata}
                onPlay={() => {
                  setIsPlaying(true);
                  savePosition(mediaRef.current?.currentTime || 0);
                }}
                onPause={() => {
                  setIsPlaying(false);
                  if (mediaRef.current) savePosition(mediaRef.current.currentTime);
                }}
                onEnded={handleMediaEnded}
                onError={() => setMediaError("This audio could not be loaded. Check your connection or try again later.")}
              >
                <source src={source.url} />
                Your browser does not support embedded audio.
              </audio>
            </div>
          )}
        </div>
      )}

      {mediaType === "video" && source?.kind === "youtube" && (
        <div className="learning-media-frame is-video" key={`youtube-${mediaAttempt}`}>
          <YouTubeLessonPlayer
            videoId={source.videoId}
            initialPosition={initialPosition}
            onPosition={savePosition}
            onEnded={handleMediaEnded}
            onError={setMediaError}
          />
        </div>
      )}

      {mediaError && (
        <div className="learning-media-unavailable" role="alert">
          <AlertCircle size={23} aria-hidden="true" />
          <p>{mediaError}</p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMediaError("");
              setMediaAttempt((attempt) => attempt + 1);
              router.refresh();
            }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Retry media
          </Button>
        </div>
      )}

      {mediaType && isMediaSourceUnavailable(source) && (
        <div className="learning-media-unavailable" role="status">
          <AlertCircle size={23} aria-hidden="true" />
          <p>{mediaMessage(source, mediaType)}</p>
        </div>
      )}

      {!mediaType && (
        <div className="learning-text-lesson-callout">
          <span><Check size={18} aria-hidden="true" /></span>
          <div>
            <strong>Work through the lesson at your own pace.</strong>
            <p>When you’re ready, mark it complete to update your course progress.</p>
          </div>
        </div>
      )}

      <div className="learning-player-footer">
        <p className="learning-sync-status" role="status" aria-live="polite">
          {errorMessage ? (
            <><AlertCircle size={15} aria-hidden="true" /> {errorMessage}</>
          ) : syncMessage ? (
            <><CircleCheck size={15} aria-hidden="true" /> {syncMessage}</>
          ) : (
            "Playback resumes from your saved position on this account."
          )}
        </p>
        {completedState ? (
          <span className="learning-completion-confirmation">
            <CircleCheck size={16} aria-hidden="true" /> Lesson completed
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={handleManualCompletion}
            leftIcon={<Check size={16} aria-hidden="true" />}
          >
            Mark lesson complete
          </Button>
        )}
      </div>

      {retryKind && errorMessage && (
        <button
          className="learning-retry-button"
          type="button"
          onClick={handleRetry}
        >
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      )}
    </section>
  );
}
